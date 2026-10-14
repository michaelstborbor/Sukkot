import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { actOnOffer, createOffer, getOffer } from "@/server/services/offers";
import { makeUser, publishedListing } from "../support/factory";

describe("purchase offers", () => {
  it("runs submit → counter → accept counter, with an append-only history and side checks", async () => {
    const seller = await makeUser(["OWNER"], "Seller");
    const mod = await makeUser(["MODERATOR"]);
    const buyer = await makeUser(["USER"], "Buyer");
    const p = await publishedListing(seller, mod, { purpose: "SALE", rentalPeriod: undefined, price: "1500000" });

    const offer = await createOffer(buyer, { propertyId: p.id, amount: "1300000", paymentArrangement: "FULL_PAYMENT", conditions: ["Subject to title search"] });
    expect(offer.status).toBe("SUBMITTED");

    await expect(actOnOffer(buyer, offer.id, { action: "accept" })).rejects.toThrow();
    await actOnOffer(seller, offer.id, { action: "counter", amount: "1450000", message: "Best I can do" });
    await expect(actOnOffer(seller, offer.id, { action: "accept_counter" })).rejects.toThrow();
    await actOnOffer(buyer, offer.id, { action: "accept_counter" });

    const view = await getOffer(buyer, offer.id);
    expect(view.status).toBe("ACCEPTED_IN_PRINCIPLE");
    expect(view.currentAmount.amountMinor).toBe("145000000");
    expect(view.events.map((e) => e.type)).toEqual(["SUBMITTED", "COUNTERED", "ACCEPTED_IN_PRINCIPLE"]);
    expect(view.dueDiligence).toHaveLength(0);
    await actOnOffer(seller, offer.id, { action: "start_due_diligence" });
    expect((await getOffer(buyer, offer.id)).dueDiligence.length).toBeGreaterThan(0);

    const stranger = await makeUser(["USER"]);
    await expect(getOffer(stranger, offer.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const listing = await db.property.findUniqueOrThrow({ where: { id: p.id } });
    // Agreement in principle is not a sale: the listing is under offer, never sold.
    expect(listing.availability).toBe("UNDER_OFFER");
  });

  it("expires an offer past its expiry date instead of accepting it", async () => {
    const seller = await makeUser(["OWNER"]);
    const mod = await makeUser(["MODERATOR"]);
    const buyer = await makeUser(["USER"]);
    const p = await publishedListing(seller, mod, { purpose: "SALE", rentalPeriod: undefined, price: "900000" });
    const offer = await createOffer(buyer, { propertyId: p.id, amount: "800000", paymentArrangement: "INSTALMENTS" });
    await db.offer.update({ where: { id: offer.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await expect(actOnOffer(seller, offer.id, { action: "accept" })).rejects.toThrow();
    expect((await db.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe("EXPIRED");
  });
});
