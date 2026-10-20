import { describe, expect, it } from "vitest";
import { GENERAL_ENQUIRY, listingEnquiry } from "@sukkot/shared";
import { whatsappMessageFor } from "@/lib/whatsapp";

describe("the WhatsApp button's message", () => {
  it("uses the listing's own message on a listing page", () => {
    const listing = listingEnquiry({ title: "Family house in Lumley", reference: "SS-26-000042", typeName: "House", locationLabel: "Lumley, Freetown", district: null, price: { formatted: "Le 25,000 / month" } });
    expect(listing).toContain("Family house in Lumley\nReference: SS-26-000042\nType: House");
    expect(whatsappMessageFor("/properties/family-house-in-lumley", listing)).toBe(listing);
    // Without one (the lister's own listing, say) it still says the question is about a property.
    expect(whatsappMessageFor("/properties/family-house-in-lumley", "")).toMatch(/question about a property/);
  });

  it("fits the message to the page", () => {
    expect(whatsappMessageFor("/properties")).toMatch(/looking for a property/);
    expect(whatsappMessageFor("/list-your-property")).toMatch(/list my property/);
    expect(whatsappMessageFor("/dashboard/properties/new")).toMatch(/adding my property listing/);
    expect(whatsappMessageFor("/dashboard/properties/abc123")).toMatch(/updating my property listing/);
    expect(whatsappMessageFor("/dashboard/properties/abc123/finish")).toMatch(/updating my property listing/);
    expect(whatsappMessageFor("/dashboard/properties")).toMatch(/my listings/);
    expect(whatsappMessageFor("/dashboard/payments")).toMatch(/payment/);
    expect(whatsappMessageFor("/dashboard/billing")).toMatch(/payment or my plan/);
    expect(whatsappMessageFor("/payments/sandbox/PAY-1")).toMatch(/payment/);
    expect(whatsappMessageFor("/dashboard/inspections")).toMatch(/viewing/);
    expect(whatsappMessageFor("/dashboard/offers/o1")).toMatch(/an offer/);
    expect(whatsappMessageFor("/dashboard/applications/a1")).toMatch(/rental application/);
    expect(whatsappMessageFor("/auth/sign-up")).toMatch(/creating an account/);
    expect(whatsappMessageFor("/auth/sign-in")).toMatch(/signing in/);
    expect(whatsappMessageFor("/auth/forgot-password")).toMatch(/signing in/);
    expect(whatsappMessageFor("/help")).toMatch(/help page/);
  });

  it("ignores a trailing slash and falls back to a general question", () => {
    expect(whatsappMessageFor("/help/")).toBe(whatsappMessageFor("/help"));
    expect(whatsappMessageFor("/")).toBe(GENERAL_ENQUIRY);
    expect(whatsappMessageFor("/about")).toBe(GENERAL_ENQUIRY);
    // Pages that only start with the same letters are not confused with each other.
    expect(whatsappMessageFor("/dashboard/paymentsx")).toBe(GENERAL_ENQUIRY);
  });

  it("keeps every message short, polite and starting with a greeting", () => {
    for (const path of ["/properties", "/list-your-property", "/dashboard/billing", "/auth/sign-in", "/help", "/agents", "/verification"]) {
      const m = whatsappMessageFor(path);
      expect(m.startsWith("Hello Sukkot Salone,")).toBe(true);
      expect(m.length).toBeLessThan(120);
    }
  });
});
