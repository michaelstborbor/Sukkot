import { describe, expect, it } from "vitest";
import {
  addMoney,
  applicationMachine,
  formatMoney,
  hasPermission,
  inspectionMachine,
  intervalsOverlap,
  listingMachine,
  minorToMajorString,
  normalizeSlPhone,
  offerMachine,
  parseMajorToMinor,
  parseSearchParams,
  percentOf,
  propertyInputSchema,
  registerSchema,
  serializeSearchParams,
  validatePropertyForCategory,
} from "../src";

describe("money", () => {
  it("parses major units into integer minor units without floats", () => {
    expect(parseMajorToMinor("85,000")).toBe(8_500_000n);
    expect(parseMajorToMinor("0.1")).toBe(10n);
    expect(parseMajorToMinor("Le 1,250.55")).toBe(125_055n);
    expect(parseMajorToMinor("12.345")).toBeNull();
    expect(parseMajorToMinor("-5")).toBeNull();
    expect(parseMajorToMinor("abc")).toBeNull();
  });
  it("round-trips and formats", () => {
    expect(minorToMajorString(125_050n)).toBe("1250.5");
    expect(formatMoney(8_500_000n, "SLE", { period: "MONTH" })).toBe("Le 85,000 / month");
    expect(formatMoney(150n, "USD")).toBe("US$ 1.50");
    expect(formatMoney(250_000_000n, "SLE", { compact: true })).toBe("Le 2.5M");
  });
  it("refuses to add different currencies", () => {
    expect(() => addMoney({ amountMinor: 1n, currency: "SLE" }, { amountMinor: 1n, currency: "USD" })).toThrow();
  });
  it("computes basis-point percentages with integer rounding", () => {
    expect(percentOf(10_000n, 500)).toBe(500n);
    expect(percentOf(333n, 1000)).toBe(33n);
  });
});

describe("phone numbers", () => {
  it("normalises Sierra Leone formats", () => {
    expect(normalizeSlPhone("076 123 456")).toBe("+23276123456");
    expect(normalizeSlPhone("+232 77 123456")).toBe("+23277123456");
    expect(normalizeSlPhone("0023230123456")).toBe("+23230123456");
    expect(normalizeSlPhone("12345")).toBeNull();
    expect(normalizeSlPhone("0012345678")).toBeNull();
  });
});

describe("property validation", () => {
  const base = {
    title: "Two bedroom flat in Aberdeen",
    description: "A bright two bedroom flat close to the beach with reliable water and a backup generator.",
    propertyTypeId: "t1",
    purpose: "RENT",
    price: "42,000",
    rentalPeriod: "MONTH",
    locationId: "l1",
    listerCapacity: "OWNER",
  } as const;
  it("requires a rental period for rentals and forbids it for sales", () => {
    expect(propertyInputSchema.safeParse(base).success).toBe(true);
    expect(propertyInputSchema.safeParse({ ...base, rentalPeriod: undefined }).success).toBe(false);
    expect(propertyInputSchema.safeParse({ ...base, purpose: "SALE" }).success).toBe(false);
  });
  it("rejects zero or invalid prices", () => {
    expect(propertyInputSchema.safeParse({ ...base, price: "0" }).success).toBe(false);
    expect(propertyInputSchema.safeParse({ ...base, price: "12.345" }).success).toBe(false);
  });
  it("applies category-specific rules", () => {
    const parsed = propertyInputSchema.parse(base);
    expect(validatePropertyForCategory(parsed, "APARTMENT").map((e) => e.path)).toEqual(["bedrooms", "bathrooms"]);
    const land = propertyInputSchema.parse({ ...base, purpose: "SALE", rentalPeriod: undefined, plotSize: 0.5, plotUnit: "TOWN_LOT" });
    expect(validatePropertyForCategory(land, "LAND")).toEqual([]);
  });
  it("rejects coordinates outside Sierra Leone", () => {
    expect(propertyInputSchema.safeParse({ ...base, latitude: 51.5, longitude: -0.1 }).success).toBe(false);
  });
});

describe("registration", () => {
  it("never lets a user self-assign a staff role", () => {
    const r = registerSchema.safeParse({
      fullName: "Test",
      email: "a@b.sl",
      password: "longpassword1",
      accountType: "SUPER_ADMIN",
      acceptTerms: true,
    });
    expect(r.success).toBe(false);
  });
});

describe("search params", () => {
  it("parses valid values and drops invalid ones individually", () => {
    const f = parseSearchParams(
      new URLSearchParams("purpose=RENT&beds=2&minPrice=abc&maxPrice=50000&verified=1&furnishing=FURNISHED,BAD&sort=bogus"),
    );
    expect(f).toEqual({ purpose: "RENT", beds: 2, maxPrice: 50000, verified: true, furnishing: ["FURNISHED"] });
  });
  it("swaps inverted price ranges and serialises stably", () => {
    const f = parseSearchParams({ minPrice: "900", maxPrice: "100", page: "1", sort: "newest" });
    expect(f.minPrice).toBe(100);
    expect(serializeSearchParams(f)).toBe("maxPrice=900&minPrice=100&sort=newest");
  });
});

describe("workflows", () => {
  it("runs an offer through counteroffer to acceptance", () => {
    let s = offerMachine.next("SUBMITTED", "counter", "SELLER");
    expect(s).toBe("COUNTEROFFER_RECEIVED");
    expect(() => offerMachine.next(s, "accept", "BUYER")).toThrow();
    s = offerMachine.next(s, "accept_counter", "BUYER");
    expect(s).toBe("ACCEPTED_IN_PRINCIPLE");
    expect(offerMachine.available(s, "BUYER")).toContain("start_due_diligence");
    expect(() => offerMachine.next(s, "complete", "SELLER")).toThrow();
  });
  it("does not let a buyer accept their own offer", () => {
    expect(offerMachine.can("SUBMITTED", "accept", "BUYER")).toBe(false);
    expect(offerMachine.can("SUBMITTED", "accept", "SELLER")).toBe(true);
  });
  it("enforces rental application transitions", () => {
    expect(applicationMachine.next("SUBMITTED", "make_offer", "LANDLORD")).toBe("OFFER_MADE");
    expect(applicationMachine.next("OFFER_MADE", "accept_offer", "APPLICANT")).toBe("APPROVED");
    expect(() => applicationMachine.next("SUBMITTED", "approve", "APPLICANT")).toThrow();
    expect(() => applicationMachine.next("REJECTED", "withdraw", "APPLICANT")).toThrow();
  });
  it("enforces listing moderation", () => {
    expect(listingMachine.next("DRAFT", "submit", "OWNER")).toBe("PENDING_REVIEW");
    expect(() => listingMachine.next("PENDING_REVIEW", "approve", "OWNER")).toThrow();
    expect(listingMachine.next("PENDING_REVIEW", "approve", "MODERATOR")).toBe("PUBLISHED");
  });
  it("enforces inspection transitions", () => {
    expect(inspectionMachine.next("REQUESTED", "confirm", "REPRESENTATIVE")).toBe("CONFIRMED");
    expect(() => inspectionMachine.next("REQUESTED", "confirm", "REQUESTER")).toThrow();
  });
});

describe("permissions and scheduling", () => {
  it("maps roles to permissions", () => {
    expect(hasPermission(["OWNER"], "listing:create")).toBe(true);
    expect(hasPermission(["USER"], "listing:create")).toBe(false);
    expect(hasPermission(["MODERATOR"], "admin:payments.manage")).toBe(false);
    expect(hasPermission(["FINANCE"], "admin:payments.manage")).toBe(true);
  });
  it("detects overlapping appointments", () => {
    const a = new Date("2026-10-20T10:00:00Z");
    expect(intervalsOverlap(a, 30, new Date("2026-10-20T10:15:00Z"), 30)).toBe(true);
    expect(intervalsOverlap(a, 30, new Date("2026-10-20T10:30:00Z"), 30)).toBe(false);
  });
});
