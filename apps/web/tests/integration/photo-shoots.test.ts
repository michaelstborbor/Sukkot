import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { reviewManualPayment, submitManualPlatformPayment } from "@/server/payments";
import { addImages, createProperty, getPropertyDetail, searchProperties } from "@/server/services/properties";
import { cancelVisit, completeVisit, requestPhotoShoot, scheduleVisit } from "@/server/services/site-visits";
import { setSetting } from "@/server/services/settings";
import { parseSearchParams } from "@sukkot/shared";
import { houseInput, makeUser, pngFile } from "../support/factory";

const txId = () => `PP${randomBytes(5).toString("hex").toUpperCase()}`;

beforeAll(async () => {
  await setSetting("billing.manual", { enabled: true, accountName: "Sukkot Salone (test)", orangeMoneyNumber: "076000000", afrimoneyNumber: "", bankDetails: "" });
  await setSetting("visit.photoShoot", { priceMinor: "30000", currency: "SLE" });
});

describe("professional photo shoots", () => {
  it("tells staff as soon as a lister asks, takes the Le 300 fee, and hands the photos back", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const finance = await makeUser(["FINANCE"]);
    const draft = await createProperty(owner, await houseInput());

    // Nobody else can ask for photos of the listing.
    await expect(requestPhotoShoot(await makeUser(["OWNER"]), draft.id, { contactPhone: "076123456" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Paying before asking is refused.
    const pay = () => submitManualPlatformPayment(owner, { purpose: "PHOTO_SHOOT", propertyId: draft.id, channel: "ORANGE_MONEY", externalReference: txId(), payerPhone: "076123456", idempotencyKey: randomUUID() });
    await expect(pay()).rejects.toMatchObject({ code: "CONFLICT" });

    const shoot = await requestPhotoShoot(owner, draft.id, { contactPhone: "076 123 456", note: "Behind the Total station, mornings are best" });
    expect(shoot).toMatchObject({ kind: "PHOTO_SHOOT", status: "REQUESTED", paymentId: null, contactPhone: "+23276123456" });
    const alert = await db.notification.findFirstOrThrow({ where: { userId: moderator.id, type: "visit.photo_requested" }, orderBy: { createdAt: "desc" } });
    expect(alert.title).toContain(draft.reference);
    expect(alert.body).toContain("Behind the Total station");
    expect(alert.body).toContain("not paid yet");
    expect((await db.property.findUniqueOrThrow({ where: { id: draft.id } })).privateContactPhone).toBe("+23276123456");
    await expect(requestPhotoShoot(owner, draft.id, { contactPhone: "076123456" })).rejects.toMatchObject({ code: "CONFLICT" });

    // The fee is priced on the server and only counts once finance confirms it.
    const payment = await pay();
    expect(payment.amount.amountMinor).toBe("30000");
    expect((await db.siteVisit.findUniqueOrThrow({ where: { id: shoot.id } })).paymentId).toBeNull();
    await reviewManualPayment(finance, payment.id, { approve: true });
    expect((await db.siteVisit.findUniqueOrThrow({ where: { id: shoot.id } })).paymentId).not.toBeNull();
    await expect(pay()).rejects.toMatchObject({ code: "CONFLICT" });

    // Staff book it, upload the photos and mark it done. No inspection badge comes with it.
    await scheduleVisit(moderator, shoot.id, { scheduledAt: new Date(Date.now() + 86400_000) });
    await expect(completeVisit(moderator, shoot.id, { note: "Photos taken on the day" })).rejects.toMatchObject({ code: "CONFLICT" });
    await addImages(moderator, draft.id, [await pngFile("shoot.png")]);
    await completeVisit(moderator, shoot.id, { note: "Twelve photos and a short video added" });
    const done = await db.notification.findFirstOrThrow({ where: { userId: owner.id, type: "visit.completed" }, orderBy: { createdAt: "desc" } });
    expect(done.title).toContain("photos are ready");
    expect((await db.property.findUniqueOrThrow({ where: { id: draft.id } })).inspectedAt).toBeNull();
  });

  it("does not promise a refund when an unpaid request is cancelled", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const draft = await createProperty(owner, await houseInput());
    const shoot = await requestPhotoShoot(owner, draft.id, { contactPhone: "076123456" });
    await cancelVisit(moderator, shoot.id, { reason: "The lister asked us to stop" });
    const n = await db.notification.findFirstOrThrow({ where: { userId: owner.id, type: "visit.cancelled" } });
    expect(n.title).toBe("Photo shoot cancelled");
    expect(n.body).not.toMatch(/refund/i);
  });
});

describe("listers' private contact details", () => {
  it("are saved with the listing but never shown to the public", async () => {
    const owner = await makeUser(["OWNER"]);
    const created = await createProperty(owner, await houseInput({ title: `Private contact test ${randomUUID().slice(0, 8)}`, privateContactPhone: "077 555 444", privateContactEmail: "Landlord@Example.com" }));
    expect(created).toMatchObject({ privateContactPhone: "+23277555444", privateContactEmail: "landlord@example.com" });
    await db.property.update({ where: { id: created.id }, data: { listingStatus: "PUBLISHED", publishedAt: new Date() } });

    const detail = JSON.stringify(await getPropertyDetail(created.slug, null));
    const search = JSON.stringify(await searchProperties(parseSearchParams({ q: created.title })));
    for (const text of [detail, search]) {
      expect(text).not.toContain("77555444");
      expect(text).not.toContain("landlord@example.com");
    }
    await expect(createProperty(owner, await houseInput({ privateContactPhone: "12345" }))).rejects.toThrow(/valid Sierra Leone phone/);
  });
});

describe("type-specific listing details", () => {
  it("stores each type's own details and drops building fields from empty land", async () => {
    const owner = await makeUser(["OWNER"]);
    const house = await createProperty(owner, await houseInput({ house: { houseStyle: "BUNGALOW", boysQuarters: true } }));
    expect(house.attributes).toEqual({ houseStyle: "BUNGALOW", boysQuarters: true });

    const land = await db.propertyType.findUniqueOrThrow({ where: { slug: "empty-land" } });
    const plot = await createProperty(owner, await houseInput({ propertyTypeId: land.id, purpose: "SALE", rentalPeriod: null, bedrooms: undefined, bathrooms: undefined, floorArea: 120, plotSize: 1, plotUnit: "TOWN_LOT", land: { accessRoad: "LATERITE" } }));
    expect(plot).toMatchObject({ floorArea: null, bedrooms: null, attributes: { accessRoad: "LATERITE" } });

    const hotel = await db.propertyType.findUniqueOrThrow({ where: { slug: "hotel" } });
    const hotelInput = await houseInput({ propertyTypeId: hotel.id, purpose: "SALE", rentalPeriod: null, bedrooms: undefined, bathrooms: undefined });
    await expect(createProperty(owner, hotelInput)).rejects.toMatchObject({ code: "VALIDATION" });
    const created = await createProperty(owner, { ...hotelInput, commercial: { rooms: 12 } });
    expect(created.attributes).toMatchObject({ rooms: 12 });
  });
});
