import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { reviewManualPayment, submitManualPlatformPayment } from "@/server/payments";
import { getEntitlements, spendFeaturedSlot } from "@/server/services/billing";
import { ownerListingAction } from "@/server/services/properties";
import { setSetting } from "@/server/services/settings";
import { makeUser, publishedListing } from "../support/factory";

const txId = () => `CI${randomBytes(5).toString("hex").toUpperCase()}`;

async function payByTransfer(user: Awaited<ReturnType<typeof makeUser>>, planCode = "landlord-pro", externalReference = txId()) {
  const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { code: planCode } });
  const p = await submitManualPlatformPayment(user, { purpose: "PLATFORM_SUBSCRIPTION", subscriptionPlanId: plan.id, channel: "ORANGE_MONEY", externalReference, idempotencyKey: randomUUID() });
  return { plan, p, externalReference };
}

beforeAll(async () => {
  await setSetting("billing.manual", { enabled: true, accountName: "Sukkot Salone (test)", orangeMoneyNumber: "076000000", afrimoneyNumber: "", bankDetails: "" });
});

describe("plans and billing", () => {
  it("stops a free account at its listing allowance until a listing is paused", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const free = await db.subscriptionPlan.findFirstOrThrow({ where: { isActive: true, priceMinor: 0 }, orderBy: { sortOrder: "asc" } });
    const live = [];
    for (let i = 0; i < free.maxListings!; i++) live.push(await publishedListing(owner, moderator));
    await expect(publishedListing(owner, moderator)).rejects.toMatchObject({ code: "CONFLICT" });

    await ownerListingAction(owner, live[0]!.id, "pause");
    const extra = await db.property.findFirstOrThrow({ where: { listerId: owner.id, listingStatus: "DRAFT" } });
    await ownerListingAction(owner, extra.id, "submit");
    // The paused listing cannot come back while the allowance is full.
    await expect(ownerListingAction(owner, live[0]!.id, "resume")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("activates a plan paid by transfer only after finance confirms it, without calling it provider-verified", async () => {
    const owner = await makeUser(["OWNER"]);
    const finance = await makeUser(["FINANCE"]);
    const { p, plan, externalReference } = await payByTransfer(owner);
    expect(p.status).toBe("PENDING");
    expect(p.amount.amountMinor).toBe(plan.priceMinor.toString());
    expect((await getEntitlements(owner.id)).subscription).toBeNull();

    // The same transaction ID cannot pay for a second purchase.
    await expect(payByTransfer(await makeUser(["OWNER"]), "landlord-pro", externalReference.toLowerCase())).rejects.toMatchObject({ code: "CONFLICT" });
    // Customers cannot confirm their own transfers.
    await expect(reviewManualPayment(owner, p.id, { approve: true })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const confirmed = await reviewManualPayment(finance, p.id, { approve: true });
    expect(confirmed.status).toBe("RECORDED");
    expect(confirmed.providerVerified).toBe(false);
    const ent = await getEntitlements(owner.id);
    expect(ent.subscription?.planId).toBe(plan.id);
    expect(ent.maxListings).toBe(plan.maxListings);
    // A second decision on the same transfer is refused.
    await expect(reviewManualPayment(finance, p.id, { approve: false, reason: "Changed my mind" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("cancels the purchase and tells the customer when finance cannot find the transfer", async () => {
    const owner = await makeUser(["OWNER"]);
    const finance = await makeUser(["FINANCE"]);
    const { p } = await payByTransfer(owner);
    await expect(reviewManualPayment(finance, p.id, { approve: false })).rejects.toBeTruthy();
    const rejected = await reviewManualPayment(finance, p.id, { approve: false, reason: "No such transaction on the statement" });
    expect(rejected.status).toBe("FAILED");
    expect((await db.subscription.findFirstOrThrow({ where: { userId: owner.id } })).status).toBe("CANCELLED");
    expect(await db.notification.count({ where: { userId: owner.id, type: "payment.rejected" } })).toBe(1);
  });

  it("queues a renewal to start when the current period ends", async () => {
    const owner = await makeUser(["OWNER"]);
    const finance = await makeUser(["FINANCE"]);
    await reviewManualPayment(finance, (await payByTransfer(owner)).p.id, { approve: true });
    await reviewManualPayment(finance, (await payByTransfer(owner)).p.id, { approve: true });
    const [first, second] = await db.subscription.findMany({ where: { userId: owner.id }, orderBy: { startsAt: "asc" } });
    expect(second!.startsAt!.getTime()).toBe(first!.endsAt!.getTime());
    expect((await getEntitlements(owner.id)).subscription?.id).toBe(first!.id);
  });

  it("spends included featured slots once each", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const finance = await makeUser(["FINANCE"]);
    const listing = await publishedListing(owner, moderator);
    await expect(spendFeaturedSlot(owner, listing.id)).rejects.toMatchObject({ code: "CONFLICT" });

    await reviewManualPayment(finance, (await payByTransfer(owner)).p.id, { approve: true });
    const slots = (await getEntitlements(owner.id)).featuredSlots;
    for (let i = 0; i < slots; i++) await spendFeaturedSlot(owner, listing.id);
    expect((await db.property.findUniqueOrThrow({ where: { id: listing.id } })).isFeatured).toBe(true);
    await expect(spendFeaturedSlot(owner, listing.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const stranger = await makeUser(["OWNER"]);
    await expect(spendFeaturedSlot(stranger, listing.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
