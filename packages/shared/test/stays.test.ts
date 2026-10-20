import { describe, expect, it } from "vitest";
import { daysBetween, normalizeGuestPhone, parseStayDate, priceStay, stayBookingRequestSchema, stayDetailsSchema, stayRefundDue } from "../src";

const base = { nightlyMinor: 50_000n, monthlyMinor: null, nights: 3, rooms: 1, leadDays: 10, noticeDays: 7, surchargePercent: 10, cleaningFeeMinor: 0n };

describe("priceStay", () => {
  it("charges the nightly rate with no late fee when booked 7 or more days ahead", () => {
    const p = priceStay({ ...base, leadDays: 7 });
    expect(p.basis).toBe("NIGHTLY");
    expect(p.stayMinor).toBe(150_000n);
    expect(p.isLate).toBe(false);
    expect(p.lateFeeMinor).toBe(0n);
    expect(p.totalMinor).toBe(150_000n);
  });

  it("adds the late booking charge when booked less than 7 days ahead", () => {
    const p = priceStay({ ...base, leadDays: 6, rooms: 2 });
    expect(p.stayMinor).toBe(300_000n);
    expect(p.isLate).toBe(true);
    expect(p.lateFeeMinor).toBe(30_000n);
    expect(p.totalMinor).toBe(330_000n);
    expect(p.lines.map((l) => l.label)).toEqual(["3 nights at the nightly rate × 2 rooms", "Late booking charge (10%, booked less than 7 days ahead)"]);
  });

  it("rounds the late fee to the nearest minor unit and skips it at 0%", () => {
    expect(priceStay({ ...base, nightlyMinor: 333n, nights: 1, leadDays: 0, surchargePercent: 12.5 }).lateFeeMinor).toBe(42n);
    expect(priceStay({ ...base, leadDays: 0, surchargePercent: 0 }).lateFeeMinor).toBe(0n);
  });

  it("uses the monthly rate for long stays and caps leftover nights at another month", () => {
    const monthly = { ...base, monthlyMinor: 1_000_000n };
    expect(priceStay({ ...monthly, nights: 27 }).basis).toBe("NIGHTLY");
    const p28 = priceStay({ ...monthly, nights: 28 });
    expect(p28.basis).toBe("MONTHLY");
    expect(p28.stayMinor).toBe(1_000_000n);
    expect(p28.lines[0]!.label).toBe("28 nights, capped at the monthly rate");
    expect(priceStay({ ...monthly, nights: 35 }).stayMinor).toBe(1_250_000n);
    expect(priceStay({ ...monthly, nights: 60 }).stayMinor).toBe(2_000_000n);
  });

  it("adds the cleaning fee once per booking", () => {
    const p = priceStay({ ...base, rooms: 1, cleaningFeeMinor: 20_000n });
    expect(p.totalMinor).toBe(170_000n);
    expect(p.lines.at(-1)).toEqual({ label: "Cleaning fee", amountMinor: 20_000n });
  });
});

describe("stayRefundDue", () => {
  it("follows each cancellation policy", () => {
    expect(stayRefundDue("FLEXIBLE", 1000n, 1)).toBe(1000n);
    expect(stayRefundDue("FLEXIBLE", 1000n, 0)).toBe(0n);
    expect(stayRefundDue("MODERATE", 1000n, 7)).toBe(1000n);
    expect(stayRefundDue("MODERATE", 1000n, 6)).toBe(500n);
    expect(stayRefundDue("STRICT", 1000n, 14)).toBe(500n);
    expect(stayRefundDue("STRICT", 1000n, 13)).toBe(0n);
    expect(stayRefundDue("NON_REFUNDABLE", 1000n, 60)).toBe(0n);
  });
});

describe("stay dates and inputs", () => {
  it("parses only real calendar dates", () => {
    expect(parseStayDate("2026-02-29")).toBeNull();
    expect(parseStayDate("2028-02-29")?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(parseStayDate("29/02/2028")).toBeNull();
    expect(daysBetween(parseStayDate("2026-10-20")!, parseStayDate("2026-10-27")!)).toBe(7);
  });

  it("accepts Sierra Leone and international guest phones", () => {
    expect(normalizeGuestPhone("076 123 456")).toBe("+23276123456");
    expect(normalizeGuestPhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizeGuestPhone("12")).toBeNull();
  });

  it("defaults check-in and check-out times and requires the policy to be accepted", () => {
    const d = stayDetailsSchema.parse({ kind: "HOTEL" });
    expect(d.checkInFrom).toBe("14:00");
    expect(d.checkOutBy).toBe("12:00");
    expect(d.cancellationPolicy).toBe("MODERATE");
    const r = stayBookingRequestSchema.safeParse({ roomTypeId: "x", checkIn: "2026-11-01", checkOut: "2026-11-03", rooms: 1, adults: 1, children: 0, guestName: "Ada", guestPhone: "076123456", guestEmail: "ada@example.com", acceptPolicy: false });
    expect(r.success).toBe(false);
  });
});
