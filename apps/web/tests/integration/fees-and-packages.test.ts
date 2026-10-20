import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { parseSearchParams } from "@sukkot/shared";
import { db } from "@/server/db";
import { confirmRecordedPayment, initiatePayment, recordPayment, reviewManualPayment, submitManualPlatformPayment } from "@/server/payments";
import { getEntitlements } from "@/server/services/billing";
import { actOnInspection, listInspections, requestInspection } from "@/server/services/inspections";
import { searchProperties } from "@/server/services/properties";
import { suggestListingNearby } from "@/server/services/search-alerts";
import { feeOn, raiseServiceFee, recordServiceFeeReceived, waiveServiceFee } from "@/server/services/service-fees";
import { setSetting } from "@/server/services/settings";
import type { Actor } from "@/server/auth/session";
import { makeUser, publishedListing, refs } from "../support/factory";

const txId = () => `TX${randomBytes(5).toString("hex").toUpperCase()}`;
const tomorrow = () => new Date(Date.now() + 86400_000);

/** Pay a platform item by transfer and have finance confirm it. */
async function payByTransfer(payer: Actor, finance: Actor, item: Record<string, string>) {
  const p = await submitManualPlatformPayment(payer, { ...item, channel: "ORANGE_MONEY", externalReference: txId(), payerPhone: "076123456", idempotencyKey: randomUUID() });
  await reviewManualPayment(finance, p.id, { approve: true });
  return p;
}

beforeAll(async () => {
  await setSetting("billing.manual", { enabled: true, accountName: "Sukkot Salone (test)", orangeMoneyNumber: "076000000", afrimoneyNumber: "", bankDetails: "" });
  await setSetting("fees.viewing", { priceMinor: "25000", currency: "SLE" });
  await setSetting("fees.success", { basisPoints: 500 });
});

describe("inspection booking fee", () => {
  it("holds a tenant's request until the Le 250 fee is confirmed, then tells the lister and our team", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const finance = await makeUser(["FINANCE"]);
    const tenant = await makeUser();
    const listing = await publishedListing(owner, moderator);

    const insp = await requestInspection(tenant, { propertyId: listing.id, scheduledAt: tomorrow() });
    expect(insp).toMatchObject({ feeMinor: 25000n, feeCurrency: "SLE", feePaidAt: null });
    // The lister hears nothing and cannot act on it yet.
    expect(await db.notification.count({ where: { userId: owner.id, type: "inspection.requested" } })).toBe(0);
    expect(await listInspections(owner)).toHaveLength(0);
    await expect(actOnInspection(owner, insp.id, { action: "confirm" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const mine = await listInspections(tenant);
    expect(mine[0]!.fee).toEqual({ amountMinor: "25000", currency: "SLE", paid: false });

    // Only the requester can pay, and the price comes from the setting.
    await expect(submitManualPlatformPayment(owner, { purpose: "VIEWING_FEE", inspectionId: insp.id, channel: "ORANGE_MONEY", externalReference: txId(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const pay = await payByTransfer(tenant, finance, { purpose: "VIEWING_FEE", inspectionId: insp.id });
    expect(pay.amount.amountMinor).toBe("25000");

    expect((await db.inspection.findUniqueOrThrow({ where: { id: insp.id } })).feePaidAt).not.toBeNull();
    expect(await db.notification.count({ where: { userId: owner.id, type: "inspection.requested" } })).toBe(1);
    const staff = await db.notification.findFirstOrThrow({ where: { userId: moderator.id, type: "inspection.fee_paid" }, orderBy: { createdAt: "desc" } });
    expect(staff.title).toContain(listing.reference);
    expect((await listInspections(owner))[0]!.fee?.paid).toBe(true);
    await actOnInspection(owner, insp.id, { action: "confirm" });
    await expect(submitManualPlatformPayment(tenant, { purpose: "VIEWING_FEE", inspectionId: insp.id, channel: "ORANGE_MONEY", externalReference: txId(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("service fee on rent and sale payments", () => {
  async function tenancy() {
    const landlord = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const tenant = await makeUser();
    const listing = await publishedListing(landlord, moderator);
    const t = await db.tenancy.create({
      data: { propertyId: listing.id, tenantId: tenant.id, landlordId: landlord.id, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400_000), rentMinor: 1_200_000n, currency: "SLE", rentalPeriod: "YEAR" },
    });
    return { landlord, tenant, listing, t };
  }

  it("charges the tenant 5% once the landlord records the rent, and only then", async () => {
    const { landlord, tenant, listing, t } = await tenancy();
    const finance = await makeUser(["FINANCE"]);
    const record = (actor: Actor, purpose: string, amount: string) =>
      recordPayment(actor, { tenancyId: t.id, purpose, method: "CASH", amount, currency: "SLE", paidAt: new Date(), idempotencyKey: randomUUID() });

    // A deposit is refundable, so it is never charged.
    await record(landlord, "SECURITY_DEPOSIT", "6000");
    expect(await db.serviceFee.count({ where: { payerId: tenant.id } })).toBe(0);

    // The tenant's own record waits for the landlord; the fee comes with the landlord's confirmation.
    const claimed = await record(tenant, "RENT", "12000");
    expect(await db.serviceFee.count({ where: { payerId: tenant.id } })).toBe(0);
    await confirmRecordedPayment(landlord, claimed.id, true);
    const fee = await db.serviceFee.findFirstOrThrow({ where: { payerId: tenant.id } });
    expect(fee).toMatchObject({ status: "DUE", baseMinor: 1_200_000n, basisPoints: 500, amountMinor: 60_000n, propertyId: listing.id, sourcePaymentId: claimed.id });
    expect(fee.description).toContain("5% service fee");
    const told = await db.notification.findFirstOrThrow({ where: { userId: tenant.id, type: "fee.due" } });
    expect(told.title).toContain("600");

    // Paying it by mobile money waits for the provider; by transfer it waits for finance.
    await expect(initiatePayment(landlord, { method: "SANDBOX", purpose: "SUCCESS_FEE", serviceFeeId: fee.id, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const pay = await submitManualPlatformPayment(tenant, { purpose: "SUCCESS_FEE", serviceFeeId: fee.id, channel: "ORANGE_MONEY", externalReference: txId(), idempotencyKey: randomUUID() });
    expect(pay.amount.amountMinor).toBe("60000");
    expect((await db.serviceFee.findUniqueOrThrow({ where: { id: fee.id } })).status).toBe("DUE");
    await reviewManualPayment(finance, pay.id, { approve: true });
    expect((await db.serviceFee.findUniqueOrThrow({ where: { id: fee.id } })).status).toBe("PAID");
    await expect(submitManualPlatformPayment(tenant, { purpose: "SUCCESS_FEE", serviceFeeId: fee.id, channel: "ORANGE_MONEY", externalReference: txId(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lets finance raise a fee for a deal done through our team, record it paid in cash, or waive it", async () => {
    const finance = await makeUser(["FINANCE"]);
    const buyer = await makeUser();
    const { listing } = await tenancy();
    const buyerEmail = (await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).email;

    await expect(raiseServiceFee(buyer, { payerEmail: buyerEmail, dealAmount: "100000", description: "Land at Waterloo" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const fee = await raiseServiceFee(finance, { payerEmail: buyerEmail, dealAmount: "100000", propertyReference: listing.reference, description: "Land at Waterloo" });
    expect(fee).toMatchObject({ amountMinor: feeOn(10_000_000n, 500), raisedById: finance.id, propertyId: listing.id, status: "DUE" });
    expect(fee.amountMinor).toBe(500_000n);

    const payment = await recordServiceFeeReceived(finance, fee.id, { method: "CASH", externalReference: "RCPT-0042" });
    expect(payment).toMatchObject({ status: "RECORDED", providerVerified: false, purpose: "SUCCESS_FEE", recordedById: finance.id, payerId: buyer.id });
    expect((await db.serviceFee.findUniqueOrThrow({ where: { id: fee.id } })).status).toBe("PAID");
    await expect(waiveServiceFee(finance, fee.id, { reason: "Changed our mind" })).rejects.toMatchObject({ code: "CONFLICT" });

    const other = await raiseServiceFee(finance, { payerEmail: buyerEmail, dealAmount: "5000", description: "Shop lease that fell through" });
    await waiveServiceFee(finance, other.id, { reason: "The lease was cancelled" });
    expect((await db.serviceFee.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("WAIVED");
    expect(await db.auditLog.count({ where: { targetId: { in: [fee.id, other.id] } } })).toBe(4);
  });
});

describe("agent packages", () => {
  it("gives agents two free listings and sells them only the agent packages", async () => {
    const agent = await makeUser(["AGENT"]);
    const owner = await makeUser(["OWNER"]);
    const ent = await getEntitlements(agent.id);
    expect(ent.plan?.code).toBe("agent-free");
    expect(ent.maxListings).toBe(2);
    expect((await getEntitlements(owner.id)).plan?.code).toBe("landlord-free");

    const [landlordPro, premium] = await Promise.all([
      db.subscriptionPlan.findUniqueOrThrow({ where: { code: "landlord-pro" } }),
      db.subscriptionPlan.findUniqueOrThrow({ where: { code: "agent-premium" } }),
    ]);
    const buy = (actor: Actor, planId: string) => initiatePayment(actor, { method: "SANDBOX", purpose: "PLATFORM_SUBSCRIPTION", subscriptionPlanId: planId, idempotencyKey: randomUUID() });
    await expect(buy(agent, landlordPro.id)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(buy(owner, premium.id)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const prices = await db.subscriptionPlan.findMany({ where: { code: { in: ["agent-basic", "agent-premium", "agent-premium-pro"] } }, orderBy: { sortOrder: "asc" } });
    expect(prices.map((p) => p.priceMinor)).toEqual([50_000n, 100_000n, 200_000n]);
    // Agent Pro, which older databases still hold, is no longer on sale.
    const onSale = await db.subscriptionPlan.findMany({ where: { audience: "AGENT", isActive: true }, orderBy: { sortOrder: "asc" } });
    expect(onSale.map((p) => p.code)).toEqual(["agent-free", "agent-basic", "agent-premium", "agent-premium-pro"]);
  });

  it("lifts a paying agent's listings in search and lets them suggest a listing to people searching nearby", async () => {
    const agent = await makeUser(["AGENT"]);
    const finance = await makeUser(["FINANCE"]);
    const moderator = await makeUser(["MODERATOR"]);
    const tag = randomUUID().slice(0, 8);
    const freeOwner = await makeUser(["OWNER"]);
    const plain = await publishedListing(freeOwner, moderator, { title: `Lift test ${tag} owner house` });
    const listing = await publishedListing(agent, moderator, { title: `Lift test ${tag} agent house` });
    await db.property.update({ where: { id: plain.id }, data: { publishedAt: new Date(Date.now() + 60_000) } });

    const order = async () => (await searchProperties(parseSearchParams({ q: `Lift test ${tag}` }))).items.map((i) => i.id);
    expect(await order()).toEqual([plain.id, listing.id]);

    // Suggestions are a paid feature.
    await expect(suggestListingNearby(agent, listing.id)).rejects.toMatchObject({ code: "CONFLICT" });

    const premium = await db.subscriptionPlan.findUniqueOrThrow({ where: { code: "agent-premium" } });
    await payByTransfer(agent, finance, { purpose: "PLATFORM_SUBSCRIPTION", subscriptionPlanId: premium.id });
    expect((await db.user.findUniqueOrThrow({ where: { id: agent.id } })).searchBoost).toBe(2);
    expect(await order()).toEqual([listing.id, plain.id]);

    // People whose saved searches cover the area hear about it; others do not.
    const { locality } = await refs();
    const nearby = await makeUser();
    const elsewhere = await makeUser();
    const quiet = await makeUser();
    const otherPlace = await db.location.findFirstOrThrow({ where: { level: "LOCALITY", id: { not: locality.id } } });
    await db.savedSearch.createMany({
      data: [
        { userId: nearby.id, name: "Near me", queryString: `locality=${locality.slug}` },
        { userId: elsewhere.id, name: "Far away", queryString: `locality=${otherPlace.slug}` },
        { userId: quiet.id, name: "No alerts", queryString: `locality=${locality.slug}`, alertsOn: false },
      ],
    });
    const sent = await suggestListingNearby(agent, listing.id);
    expect(sent.recipients).toBeGreaterThanOrEqual(1);
    expect(sent.left).toBe(premium.areaSuggestions - 1);
    expect(await db.notification.count({ where: { userId: nearby.id, type: "listing.suggestion" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: { in: [elsewhere.id, quiet.id] }, type: "listing.suggestion" } })).toBe(0);
    await expect(suggestListingNearby(agent, listing.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await getEntitlements(agent.id)).suggestionsUsed).toBe(1);
  });
});
