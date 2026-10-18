import { describe, expect, it } from "vitest";
import { rentRanges, shares } from "@/server/services/area-guide";

const row = (bedrooms: number | null, price: number, rentalPeriod: string | null = "MONTH", typeSlug = "apartment") => ({ typeSlug, bedrooms, priceMinor: BigInt(price * 100), rentalPeriod });

describe("rentRanges", () => {
  it("needs at least three listings of a kind before it shows a range", () => {
    expect(rentRanges([row(1, 1000), row(1, 2000)])).toEqual([]);
  });

  it("turns longer periods into a monthly figure and leaves out nightly and weekly prices", () => {
    const [r] = rentRanges([row(2, 3000), row(2, 36000, "YEAR"), row(2, 15000, "HALF_YEAR"), row(2, 500, "DAY"), row(2, 900, "WEEK")]);
    expect(r).toMatchObject({ label: "2 bedrooms", count: 3, lowMinor: 250000n, medianMinor: 300000n, highMinor: 300000n });
  });

  it("groups rooms and studios together and big houses into one band, in a fixed order", () => {
    const ranges = rentRanges([
      row(5, 9000), row(4, 8000), row(6, 12000),
      row(1, 900, "MONTH", "room"), row(null, 1100, "MONTH", "studio"), row(1, 1000, "MONTH", "room"),
      row(null, 4000), // no bedroom count, not a room or studio: left out
    ]);
    expect(ranges.map((r) => r.label)).toEqual(["Rooms and studios", "4 or more bedrooms"]);
    expect(ranges[1]).toMatchObject({ lowMinor: 800000n, medianMinor: 900000n, highMinor: 1200000n });
  });

  it("averages the two middle prices for an even count", () => {
    const [r] = rentRanges([row(3, 1000), row(3, 2000), row(3, 3000), row(3, 4000)]);
    expect(r!.medianMinor).toBe(250000n);
  });
});

describe("shares", () => {
  it("gives rounded percentages, most common first, ignoring unknowns", () => {
    expect(shares(["A", "B", "A", null, "A"], { A: "Alpha", B: "Beta" })).toEqual([
      { label: "Alpha", percent: 75 },
      { label: "Beta", percent: 25 },
    ]);
    expect(shares(["A", null], { A: "Alpha" })).toEqual([]);
  });
});
