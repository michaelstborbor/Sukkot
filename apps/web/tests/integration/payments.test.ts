import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { confirmRecordedPayment, handleWebhook, initiatePayment, recordPayment } from "@/server/payments";
import { signSandboxPayload } from "@/server/payments/providers/sandbox";
import { makeUser } from "../support/factory";

async function webhook(body: Record<string, unknown>, signature?: string) {
  const raw = JSON.stringify(body);
  return handleWebhook("SANDBOX", { headers: new Headers({ "x-sandbox-signature": signature ?? signSandboxPayload(raw) }), rawBody: raw, url: "http://localhost/api/v1/payments/webhooks/sandbox" });
}

async function startPlanPayment() {
  const user = await makeUser(["OWNER"]);
  const plan = await db.subscriptionPlan.findFirstOrThrow({ where: { priceMinor: { gt: 0 }, isActive: true, audience: "LANDLORD" } });
  const key = randomUUID();
  const p = await initiatePayment(user, { method: "SANDBOX", purpose: "PLATFORM_SUBSCRIPTION", subscriptionPlanId: plan.id, idempotencyKey: key });
  return { user, plan, key, p, tx: await db.paymentTransaction.findUniqueOrThrow({ where: { id: p.id } }) };
}

describe("payments", () => {
  it("prices plans on the server and is idempotent per key", async () => {
    const { user, plan, key, p } = await startPlanPayment();
    expect(p.status).toBe("PENDING");
    expect(p.amount.amountMinor).toBe(plan.priceMinor.toString());
    const again = await initiatePayment(user, { method: "SANDBOX", purpose: "PLATFORM_SUBSCRIPTION", subscriptionPlanId: plan.id, idempotencyKey: key });
    expect(again.id).toBe(p.id);
    expect(await db.paymentTransaction.count({ where: { payerId: user.id } })).toBe(1);
  });

  it("refuses to collect rent, deposits or sale money online", async () => {
    const user = await makeUser();
    await expect(initiatePayment(user, { method: "SANDBOX", purpose: "RENT", amount: "1000", idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("marks paid only after a correctly signed callback, once, and activates the plan", async () => {
    const { tx, user } = await startPlanPayment();
    const event = { eventId: randomUUID(), providerReference: tx.providerReference, status: "SUCCEEDED", amountMinor: tx.amountMinor.toString(), currency: tx.currency };

    await expect(webhook(event, "deadbeef")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await db.paymentTransaction.findUniqueOrThrow({ where: { id: tx.id } })).status).toBe("PENDING");

    const first = await webhook(event);
    expect(first.status).toBe("SUCCEEDED");
    const dup = await webhook(event);
    expect(dup.duplicate).toBe(true);

    const after = await db.paymentTransaction.findUniqueOrThrow({ where: { id: tx.id }, include: { events: true } });
    expect(after.providerVerified).toBe(true);
    expect(after.events.filter((e) => e.type === "webhook")).toHaveLength(1);
    const sub = await db.subscription.findFirstOrThrow({ where: { userId: user.id } });
    expect(sub.status).toBe("ACTIVE");
  });

  it("flags an amount mismatch as disputed instead of paid", async () => {
    const { tx } = await startPlanPayment();
    const res = await webhook({ eventId: randomUUID(), providerReference: tx.providerReference, status: "SUCCEEDED", amountMinor: "1", currency: tx.currency });
    expect(res.status).toBe("DISPUTED");
    const after = await db.paymentTransaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(after.providerVerified).toBe(false);
  });

  it("records off-platform rent: payer records are pending until the payee confirms", async () => {
    const landlord = await makeUser(["OWNER"]);
    const tenant = await makeUser();
    const prop = await db.property.findFirstOrThrow({ where: { listingStatus: "PUBLISHED" } });
    const tenancy = await db.tenancy.create({
      data: {
        propertyId: prop.id, tenantId: tenant.id, landlordId: landlord.id, status: "ACTIVE", startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400_000),
        rentMinor: 500_000n, currency: "SLE", rentalPeriod: "MONTH",
        schedule: { create: [{ dueDate: new Date(), amountMinor: 500_000n, currency: "SLE", label: "Rent" }] },
      },
    });
    const byTenant = await recordPayment(tenant, { method: "ORANGE_MONEY", purpose: "RENT", amount: "5000", currency: "SLE", paidAt: new Date().toISOString(), tenancyId: tenancy.id, idempotencyKey: randomUUID() });
    expect(byTenant.status).toBe("PENDING");
    expect(byTenant.providerVerified).toBe(false);
    await expect(confirmRecordedPayment(tenant, byTenant.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const confirmed = await confirmRecordedPayment(landlord, byTenant.id, true);
    expect(confirmed.status).toBe("RECORDED");
    expect(confirmed.providerVerified).toBe(false);
    const row = await db.rentScheduleItem.findFirstOrThrow({ where: { tenancyId: tenancy.id } });
    expect(row.settledAt).not.toBeNull();
  });
});
