import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { recordPlatformRefund, reviewManualPayment, submitManualPlatformPayment } from "@/server/payments";
import { getEntitlements } from "@/server/services/billing";
import { setSearchAlerts, saveSearch } from "@/server/services/favorites";
import { addImages, getPropertyDetail, searchProperties } from "@/server/services/properties";
import { cancelVisit, completeVisit, scheduleVisit } from "@/server/services/site-visits";
import { areaGuide } from "@/server/services/area-guide";
import { setSetting } from "@/server/services/settings";
import { makeUser, pngFile, publishedListing, refs } from "../support/factory";

const txId = () => `CI${randomBytes(5).toString("hex").toUpperCase()}`;

beforeAll(async () => {
  await setSetting("billing.manual", { enabled: true, accountName: "Sukkot Salone (test)", orangeMoneyNumber: "076000000", afrimoneyNumber: "", bankDetails: "" });
  await setSetting("visit.inspection", { priceMinor: "35000", currency: "SLE" });
  await setSetting("listing.extraSlot", { priceMinor: "10000", currency: "SLE" });
});

async function alertsFor(userId: string, propertyId: string) {
  const p = await db.property.findUniqueOrThrow({ where: { id: propertyId }, select: { slug: true } });
  return db.notification.count({ where: { userId, type: "search.alert", link: `/properties/${p.slug}` } });
}

describe("search alerts", () => {
  it("tells people whose saved search matches a listing when it goes live, once each", async () => {
    const { locality } = await refs();
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const seeker = await makeUser();
    const other = await makeUser();
    const muted = await makeUser();
    const bedroomsTag = 7;
    // Two matching searches from one person still give one notification.
    await saveSearch(seeker, "Big houses", `purpose=RENT&locality=${locality.slug}&beds=${bedroomsTag}`);
    await saveSearch(seeker, "Anything this big", `beds=${bedroomsTag}`);
    await saveSearch(other, "For sale", `purpose=SALE&beds=${bedroomsTag}`);
    const off = await saveSearch(muted, "Muted", `beds=${bedroomsTag}`);
    await setSearchAlerts(muted, off.id, false);
    // The lister's own search never alerts them about their own listing.
    await saveSearch(owner, "Mine", `beds=${bedroomsTag}`);

    const p = await publishedListing(owner, moderator, { bedrooms: bedroomsTag });

    expect(await alertsFor(seeker.id, p.id)).toBe(1);
    expect(await alertsFor(other.id, p.id)).toBe(0);
    expect(await alertsFor(muted.id, p.id)).toBe(0);
    expect(await alertsFor(owner.id, p.id)).toBe(0);
    expect((await db.savedSearch.findFirstOrThrow({ where: { userId: seeker.id, name: "Big houses" } })).lastAlertAt).not.toBeNull();
  });

  it("only lets you switch alerts on your own searches", async () => {
    const a = await makeUser();
    const s = await saveSearch(a, "Mine", "purpose=RENT");
    await expect(setSearchAlerts(await makeUser(), s.id, false)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("inspection visits", () => {
  async function payForVisit(owner: Awaited<ReturnType<typeof makeUser>>, propertyId: string) {
    return submitManualPlatformPayment(owner, { purpose: "INSPECTION_VISIT", propertyId, channel: "ORANGE_MONEY", externalReference: txId(), payerPhone: "076123456", idempotencyKey: randomUUID() });
  }

  it("opens a visit once finance confirms the payment, and the badge appears only after staff complete it", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const finance = await makeUser(["FINANCE"]);
    const p = await publishedListing(owner, moderator);

    // Somebody else's listing cannot be booked.
    await expect(payForVisit(await makeUser(["OWNER"]), p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const pay = await payForVisit(owner, p.id);
    expect(pay.amount.amountMinor).toBe("35000");
    expect(await db.siteVisit.count({ where: { propertyId: p.id } })).toBe(0);
    await reviewManualPayment(finance, pay.id, { approve: true });
    const visit = await db.siteVisit.findFirstOrThrow({ where: { propertyId: p.id } });
    expect(visit.status).toBe("REQUESTED");
    expect(visit.contactPhone).toBe("+23276123456");

    // A second visit cannot be bought while one is open.
    await expect(payForVisit(owner, p.id)).rejects.toMatchObject({ code: "CONFLICT" });
    // Staff cannot mark it done before booking a date, and listers cannot run visits.
    await expect(completeVisit(moderator, visit.id, { note: "Looked fine from the road" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(scheduleVisit(owner, visit.id, { scheduledAt: new Date(Date.now() + 86400_000) })).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Staff cannot touch the photos until the visit is booked.
    await expect(addImages(moderator, p.id, [await pngFile()])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await scheduleVisit(moderator, visit.id, { scheduledAt: new Date(Date.now() + 86400_000), note: "Musa will come at 10am" });
    await addImages(moderator, p.id, [await pngFile("visit.png")]);
    expect((await getPropertyDetail(p.id, null))!.inspectedAt).toBeNull();

    await completeVisit(moderator, visit.id, { note: "Rooms, water and power match the listing." });
    const detail = (await getPropertyDetail(p.id, null))!;
    expect(detail.inspectedAt).not.toBeNull();
    expect(detail.images).toHaveLength(2);
    // Once the visit is done, staff lose access to the photos again.
    await expect(addImages(moderator, p.id, [await pngFile()])).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.notification.count({ where: { userId: owner.id, type: "visit.completed" } })).toBe(1);
    const found = await searchProperties({ q: p.reference });
    expect(found.items[0]?.inspectedAt).toBe(detail.inspectedAt);
  });

  it("hides the badge once the visit is more than a year old", async () => {
    const owner = await makeUser(["OWNER"]);
    const p = await publishedListing(owner, await makeUser(["MODERATOR"]));
    await db.property.update({ where: { id: p.id }, data: { inspectedAt: new Date(Date.now() - 400 * 86400_000) } });
    expect((await getPropertyDetail(p.id, null))!.inspectedAt).toBeNull();
  });

  it("lets finance record the refund when a visit is cancelled", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const finance = await makeUser(["FINANCE"]);
    const p = await publishedListing(owner, moderator);
    const pay = await payForVisit(owner, p.id);
    await reviewManualPayment(finance, pay.id, { approve: true });
    const visit = await db.siteVisit.findFirstOrThrow({ where: { propertyId: p.id } });
    await cancelVisit(moderator, visit.id, { reason: "We cannot reach the area this month." });
    expect((await db.siteVisit.findUniqueOrThrow({ where: { id: visit.id } })).status).toBe("CANCELLED");

    await expect(recordPlatformRefund(moderator, pay.id, { reason: "Visit cancelled", externalReference: "RF12345" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const refunded = await recordPlatformRefund(finance, pay.id, { reason: "Visit cancelled", externalReference: "RF12345" });
    expect(refunded.status).toBe("REFUNDED");
    expect(await db.refund.count({ where: { transactionId: pay.id } })).toBe(1);
    await expect(recordPlatformRefund(finance, pay.id, { reason: "Again", externalReference: "RF12346" })).rejects.toMatchObject({ code: "CONFLICT" });
    // A new visit can be booked once the old one is closed.
    expect((await payForVisit(owner, p.id)).status).toBe("PENDING");
  });
});

describe("extra listing slots", () => {
  it("adds one listing to the allowance for good, only after the payment is confirmed", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const finance = await makeUser(["FINANCE"]);
    const before = await getEntitlements(owner.id);
    expect(before.maxListings).not.toBeNull();
    for (let i = 0; i < before.maxListings!; i++) await publishedListing(owner, moderator);
    await expect(publishedListing(owner, moderator)).rejects.toMatchObject({ code: "CONFLICT" });

    const pay = await submitManualPlatformPayment(owner, { purpose: "LISTING_SLOT", channel: "ORANGE_MONEY", externalReference: txId(), idempotencyKey: randomUUID() });
    expect(pay.amount.amountMinor).toBe("10000");
    expect((await getEntitlements(owner.id)).maxListings).toBe(before.maxListings);
    await reviewManualPayment(finance, pay.id, { approve: true });
    const after = await getEntitlements(owner.id);
    expect(after.maxListings).toBe(before.maxListings! + 1);
    expect(after.extraSlots).toBe(1);

    const draft = await db.property.findFirstOrThrow({ where: { listerId: owner.id, listingStatus: "DRAFT" } });
    const { ownerListingAction } = await import("@/server/services/properties");
    await ownerListingAction(owner, draft.id, "submit");
    expect((await db.property.findUniqueOrThrow({ where: { id: draft.id } })).listingStatus).toBe("PENDING_REVIEW");
  });
});

describe("room and studio types", () => {
  it("are on the property type list next to apartments", async () => {
    const types = await db.propertyType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    const slugs = types.map((t) => t.slug);
    expect(slugs.indexOf("room")).toBe(slugs.indexOf("apartment") + 1);
    expect(slugs.indexOf("studio")).toBe(slugs.indexOf("room") + 1);
    expect(types.find((t) => t.slug === "studio")?.category).toBe("APARTMENT");
  });
});

describe("area guide", () => {
  it("shows rent ranges from live, non-demo listings once there are enough", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const slug = `guide-${randomBytes(3).toString("hex")}`;
    const parent = await db.location.findFirstOrThrow({ where: { level: "CITY" } });
    const area = await db.location.create({ data: { name: "Guide Test Area", slug, level: "LOCALITY", parentId: parent.id, pathIds: [...parent.pathIds] } });
    await db.location.update({ where: { id: area.id }, data: { pathIds: [...parent.pathIds, area.id] } });
    await db.user.update({ where: { id: owner.id }, data: { extraListingSlots: 10 } });

    expect((await areaGuide(area.id)).rents).toEqual([]);
    for (const [price, period] of [["3000", "MONTH"], ["4000", "MONTH"], ["60000", "YEAR"]] as const) {
      await publishedListing(owner, moderator, { locationId: area.id, bedrooms: 2, price, rentalPeriod: period, waterSupply: "BOREHOLE", electricity: "EDSA_GRID" });
    }
    const guide = await areaGuide(area.id);
    expect(guide.rents).toHaveLength(1);
    expect(guide.rents[0]).toMatchObject({ label: "2 bedrooms", count: 3, lowMinor: 300000n, medianMinor: 400000n, highMinor: 500000n });
    expect(guide.water).toEqual([{ label: expect.any(String), percent: 100 }]);
  });
});
