import { formatMoney, RENTAL_PERIOD_LABELS, type MoneyDTO, type RentalPeriod } from "@sukkot/shared";

export function priceLabel(price: MoneyDTO, period: RentalPeriod | null) {
  return formatMoney(BigInt(price.amountMinor), price.currency, { period });
}

export function humanize(value: string) {
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function periodLabel(p: RentalPeriod | null) {
  return p ? RENTAL_PERIOD_LABELS[p] : "";
}

/** "2026-10-20" + "14:30" in Freetown time (GMT, no DST) -> ISO instant. Returns null if invalid. */
export function freetownToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
