import "server-only";
import { ELECTRICITY_LABELS, WATER_SUPPLY_LABELS, formatMoney, type Electricity, type WaterSupply } from "@sukkot/shared";
import { db } from "../db";

/** A range is shown only once at least this many live listings of that kind back it. */
export const MIN_SAMPLE = 3;

const MONTHS: Record<string, number> = { MONTH: 1, QUARTER: 3, HALF_YEAR: 6, YEAR: 12 };

export interface RentRow {
  typeSlug: string;
  bedrooms: number | null;
  priceMinor: bigint;
  rentalPeriod: string | null;
}

export interface RentRange {
  label: string;
  count: number;
  lowMinor: bigint;
  medianMinor: bigint;
  highMinor: bigint;
}

function kindOf(r: RentRow): string | null {
  if (r.typeSlug === "room" || r.typeSlug === "studio") return "Rooms and studios";
  if (r.bedrooms === null || r.bedrooms < 1) return null;
  if (r.bedrooms >= 4) return "4 or more bedrooms";
  return `${r.bedrooms} bedroom${r.bedrooms === 1 ? "" : "s"}`;
}

const ORDER = ["Rooms and studios", "1 bedroom", "2 bedrooms", "3 bedrooms", "4 or more bedrooms"];

/**
 * Monthly rent ranges by kind of home, from live listings. Rents quoted per quarter, half year or
 * year are divided down to a month; nightly and weekly prices are left out. Kinds with fewer than
 * MIN_SAMPLE listings are dropped rather than shown as a misleading "range" of one or two homes.
 */
export function rentRanges(rows: RentRow[]): RentRange[] {
  const groups = new Map<string, bigint[]>();
  for (const r of rows) {
    const months = r.rentalPeriod ? MONTHS[r.rentalPeriod] : undefined;
    const kind = kindOf(r);
    if (!months || !kind) continue;
    const list = groups.get(kind) ?? [];
    list.push(r.priceMinor / BigInt(months));
    groups.set(kind, list);
  }
  return ORDER.flatMap((label) => {
    const prices = (groups.get(label) ?? []).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (prices.length < MIN_SAMPLE) return [];
    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 ? prices[mid]! : (prices[mid - 1]! + prices[mid]!) / 2n;
    return [{ label, count: prices.length, lowMinor: prices[0]!, medianMinor: median, highMinor: prices[prices.length - 1]! }];
  });
}

/** Share of listings reporting each water or power source, most common first. */
export function shares<T extends string>(values: (T | null)[], labels: Record<T, string>) {
  const known = values.filter((v): v is T => v !== null);
  if (known.length < MIN_SAMPLE) return [];
  const counts = new Map<T, number>();
  for (const v of known) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([v, n]) => ({ label: labels[v], percent: Math.round((n / known.length) * 100) }));
}

/**
 * What live listings say about an area: rent ranges by kind of home, and how listed homes get water
 * and power. Demo listings and prices in dollars are left out so the figures reflect real Leone rents.
 */
export async function areaGuide(locationId: string) {
  const rows = await db.property.findMany({
    where: { listingStatus: "PUBLISHED", isDemo: false, locationPathIds: { has: locationId }, category: { in: ["HOUSE", "APARTMENT"] } },
    select: { purpose: true, currency: true, priceMinor: true, rentalPeriod: true, bedrooms: true, waterSupply: true, electricity: true, propertyType: { select: { slug: true } } },
  });
  const rents = rows.filter((r) => r.purpose === "RENT" && r.currency === "SLE");
  return {
    homes: rows.length,
    rents: rentRanges(rents.map((r) => ({ typeSlug: r.propertyType.slug, bedrooms: r.bedrooms, priceMinor: r.priceMinor, rentalPeriod: r.rentalPeriod }))).map((r) => ({
      ...r,
      low: formatMoney(r.lowMinor, "SLE"),
      median: formatMoney(r.medianMinor, "SLE"),
      high: formatMoney(r.highMinor, "SLE"),
    })),
    water: shares<WaterSupply>(rows.map((r) => r.waterSupply), WATER_SUPPLY_LABELS),
    power: shares<Electricity>(rows.map((r) => r.electricity), ELECTRICITY_LABELS),
  };
}
