import { describe, expect, it } from "vitest";
import { buildRentSchedule } from "@/server/services/applications";
import { toJson } from "@/server/http";

describe("rent schedule", () => {
  it("creates one row per period plus a deposit, in minor units", () => {
    const rows = buildRentSchedule({ startDate: new Date("2026-11-01T00:00:00Z"), leaseMonths: 12, rentMinor: 4_200_000n, currency: "SLE", rentalPeriod: "MONTH", depositMinor: 8_400_000n });
    const rent = rows.filter((r) => r.label !== "Security deposit");
    expect(rent).toHaveLength(12);
    expect(rows.find((r) => r.label === "Security deposit")?.amountMinor).toBe(8_400_000n);
    expect(rent.every((r) => r.amountMinor === 4_200_000n)).toBe(true);
  });

  it("handles yearly rent paid in advance", () => {
    const rows = buildRentSchedule({ startDate: new Date("2026-11-01T00:00:00Z"), leaseMonths: 24, rentMinor: 50_000_000n, currency: "SLE", rentalPeriod: "YEAR", depositMinor: null });
    expect(rows).toHaveLength(2);
  });
});

describe("JSON serialisation", () => {
  it("never loses precision on BigInt money", () => {
    expect(toJson({ a: 9_007_199_254_740_993n })).toBe('{"a":"9007199254740993"}');
  });
});
