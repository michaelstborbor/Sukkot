import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { handleWebhook, initiatePayment } from "@/server/payments";
import { signSandboxPayload } from "@/server/payments/providers/sandbox";
import { createProperty, moderateListing } from "@/server/services/properties";
import { createReport } from "@/server/services/reports";
import { raiseServiceFee, waiveServiceFee } from "@/server/services/service-fees";
import { setSetting } from "@/server/services/settings";
import { submitVerification } from "@/server/services/verification";
import { houseInput, makeUser, pngFile, publishedListing } from "../support/factory";

async function webhook(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  return handleWebhook("SANDBOX", { headers: new Headers({ "x-sandbox-signature": signSandboxPayload(raw) }), rawBody: raw, url: "http://localhost/api/v1/payments/webhooks/sandbox" });
}

describe("security fixes", () => {
  it("does not let a verification request touch someone else's listing", async () => {
    const mod = await makeUser(["MODERATOR"]);
    const victim = await makeUser(["OWNER"]);
    const attacker = await makeUser(["OWNER"]);
    const listing = await publishedListing(victim, mod);
    const before = listing.documentsStatus;
    const files = [{ label: "ID", file: await pngFile() }];

    await expect(submitVerification(attacker, { kind: "IDENTITY", propertyId: listing.id }, files)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(submitVerification(attacker, { kind: "PROPERTY_DOCUMENTS", propertyId: listing.id }, files)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const agency = await db.agency.create({ data: { name: "Someone else's agency", slug: `agency-${randomUUID()}` } });
    await expect(submitVerification(attacker, { kind: "IDENTITY", agencyId: agency.id }, files)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await db.property.findUniqueOrThrow({ where: { id: listing.id } })).documentsStatus).toBe(before);
  });

  it("fulfils a payment once when several success callbacks arrive together", async () => {
    await setSetting("promotion.featured7d", { priceMinor: "50000", currency: "SLE" });
    try {
      const owner = await makeUser(["OWNER"]);
      const listing = await publishedListing(owner, await makeUser(["MODERATOR"]));
      const p = await initiatePayment(owner, { method: "SANDBOX", purpose: "LISTING_PROMOTION", propertyId: listing.id, idempotencyKey: randomUUID() });
      const tx = await db.paymentTransaction.findUniqueOrThrow({ where: { id: p.id } });
      const event = () => ({ eventId: randomUUID(), providerReference: tx.providerReference, status: "SUCCEEDED", amountMinor: tx.amountMinor.toString(), currency: tx.currency });
      await Promise.all(Array.from({ length: 5 }, () => webhook(event())));
      expect(await db.featuredListing.count({ where: { propertyId: listing.id } })).toBe(1);
    } finally {
      await setSetting("promotion.featured7d", null);
    }
  });

  it("does not let finance waive a fee they owe", async () => {
    const finance = await makeUser(["FINANCE"]);
    const colleague = await makeUser(["FINANCE"]);
    const email = (await db.user.findUniqueOrThrow({ where: { id: colleague.id } })).email;
    const fee = await raiseServiceFee(finance, { payerEmail: email, dealAmount: "5000", description: "Shop lease" });
    await expect(waiveServiceFee(colleague, fee.id, { reason: "Deal fell through" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await waiveServiceFee(finance, fee.id, { reason: "Deal fell through" });
  });

  it("does not let a moderator approve their own listing", async () => {
    const modOwner = await makeUser(["MODERATOR", "OWNER"]);
    const p = await createProperty(modOwner, await houseInput());
    await expect(moderateListing(modOwner, p.id, { action: "approve", featured: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("asks anonymous reporters to sign in before attaching a message", async () => {
    await expect(createReport(null, { type: "SUSPECTED_FRAUD", reason: "This message asks for money up front", contactEmail: "a@b.sl", messageId: randomUUID() })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
