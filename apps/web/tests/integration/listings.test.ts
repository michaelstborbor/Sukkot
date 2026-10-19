import { describe, expect, it } from "vitest";
import { parseSearchParams } from "@sukkot/shared";
import { db } from "@/server/db";
import { addImages, createProperty, getPropertyDetail, moderateListing, ownerListingAction, searchProperties, updateProperty } from "@/server/services/properties";
import { houseInput, makeUser, pngFile, publishedListing, refs } from "../support/factory";

describe("listings", () => {
  it("keeps the lister's phone number and street out of the public listing page", async () => {
    const owner = await makeUser(["OWNER"]);
    const mod = await makeUser(["MODERATOR"]);
    const description = "Spacious family house with a garden and a borehole. Call the landlord on 076 123 456 to view.";
    const p = await publishedListing(owner, mod, { description, addressLine: "12 Wilkinson Road", showExactLocation: true });

    const visitor = await getPropertyDetail(p.slug, null);
    expect(visitor!.description).not.toContain("076 123 456");
    expect(visitor!.description).toContain("use the Call or WhatsApp buttons");
    expect(visitor!.addressLine).toBeNull();
    expect(visitor!.lister.phone).toBeNull();

    const lister = await getPropertyDetail(p.slug, owner);
    expect(lister!.description).toBe(description);
    expect(lister!.addressLine).toBe("12 Wilkinson Road");
  });

  it("goes draft → review → published, and only then appears in search", async () => {
    const owner = await makeUser(["OWNER"], "Owner One");
    const mod = await makeUser(["MODERATOR"], "Moderator");
    const input = await houseInput({ title: "Unique searchable bungalow Kissy test" });
    const p = await createProperty(owner, input);
    expect(p.listingStatus).toBe("DRAFT");
    expect(p.priceMinor).toBe(1_200_000n);

    await expect(ownerListingAction(owner, p.id, "submit")).rejects.toMatchObject({ code: "VALIDATION" });
    await addImages(owner, p.id, [await pngFile()]);
    await ownerListingAction(owner, p.id, "submit");

    const before = await searchProperties(parseSearchParams({ q: "Unique searchable bungalow" }));
    expect(before.items.find((i) => i.id === p.id)).toBeUndefined();
    expect(await getPropertyDetail(p.slug, null)).toBeNull();

    await expect(moderateListing(mod, p.id, { action: "reject" })).rejects.toMatchObject({ code: "VALIDATION" });
    await moderateListing(mod, p.id, { action: "approve" });
    const after = await searchProperties(parseSearchParams({ q: "Unique searchable bungalow" }));
    expect(after.items.map((i) => i.id)).toContain(p.id);

    const history = await db.propertyStatusHistory.findMany({ where: { propertyId: p.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.toValue)).toEqual(["DRAFT", "PENDING_REVIEW", "PUBLISHED"]);
  });

  it("keeps the lister's own words for Other, and rooms for land with a property on it", async () => {
    const owner = await makeUser(["OWNER"]);
    const [other, landWithProperty, emptyLand] = await Promise.all(
      ["other", "land-with-property", "empty-land"].map((slug) => db.propertyType.findUniqueOrThrow({ where: { slug } })),
    );
    await expect(createProperty(owner, await houseInput({ propertyTypeId: other.id, floorArea: 80 }))).rejects.toMatchObject({
      fields: expect.objectContaining({ propertyTypeOther: expect.any(String) }),
    });
    const fuel = await createProperty(owner, await houseInput({ propertyTypeId: other.id, propertyTypeOther: "Fuel station" }));
    expect(fuel.category).toBe("OTHER");
    expect(fuel.propertyTypeOther).toBe("Fuel station");

    const land = { purpose: "SALE", rentalPeriod: undefined, plotSize: 2, plotUnit: "TOWN_LOT", propertyTypeOther: "ignored" };
    const withHouse = await createProperty(owner, await houseInput({ ...land, propertyTypeId: landWithProperty.id }));
    expect(withHouse.bedrooms).toBe(3);
    expect(withHouse.propertyTypeOther).toBeNull();
    const bare = await createProperty(owner, await houseInput({ ...land, propertyTypeId: emptyLand.id, bedrooms: undefined, bathrooms: undefined }));
    expect(bare.bedrooms).toBeNull();
  });

  it("enforces category rules and ownership", async () => {
    const owner = await makeUser(["OWNER"]);
    const stranger = await makeUser(["OWNER"]);
    const { land } = await refs();
    await expect(createProperty(owner, await houseInput({ propertyTypeId: land.id, purpose: "SALE", rentalPeriod: undefined }))).rejects.toMatchObject({
      code: "VALIDATION",
      fields: expect.objectContaining({ plotSize: expect.any(String) }),
    });
    await expect(createProperty(owner, await houseInput({ listerCapacity: "AGENT_FOR_OWNER" }))).rejects.toMatchObject({ code: "VALIDATION" });
    const p = await createProperty(owner, await houseInput());
    await expect(updateProperty(stranger, p.id, await houseInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const tenant = await makeUser(["USER"]);
    await expect(createProperty(tenant, await houseInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("filters by price, bedrooms and location", async () => {
    const { locality } = await refs();
    const res = await searchProperties(parseSearchParams({ minPrice: "1000", beds: "2", locality: locality.slug }));
    for (const item of res.items) {
      expect(item.bedrooms ?? 0).toBeGreaterThanOrEqual(2);
    }
    const none = await searchProperties(parseSearchParams({ minPrice: "999999999" }));
    expect(none.total).toBe(0);
  });

  it("never publishes the lister's own phone or WhatsApp number", async () => {
    const owner = await makeUser(["OWNER"]);
    await db.user.update({ where: { id: owner.id }, data: { phone: "+23276123456", profile: { update: { whatsapp: "+23276123456", showPhone: true } } } });
    const listing = await publishedListing(owner, await makeUser(["MODERATOR"]));
    const detail = await getPropertyDetail(listing.slug, null);
    expect(detail!.lister.phone).toBeNull();
    expect(detail!.lister.whatsapp).toBeNull();
    expect(JSON.stringify(detail)).not.toContain("76123456");
  });

  it("accepts a short description, but not an empty one", async () => {
    const owner = await makeUser(["OWNER"]);
    const p = await createProperty(owner, await houseInput({ description: "Nice house." }));
    expect(p.description).toBe("Nice house.");
    await expect(createProperty(owner, await houseInput({ description: "   " }))).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ["description"], message: "Describe the property" })],
    });
  });
});
