import { describe, expect, it } from "vitest";
import { parseSearchParams } from "@sukkot/shared";
import { db } from "@/server/db";
import { addImages, createProperty, getPropertyDetail, moderateListing, ownerListingAction, searchProperties, updateProperty } from "@/server/services/properties";
import { houseInput, makeUser, pngFile, refs } from "../support/factory";

describe("listings", () => {
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
});
