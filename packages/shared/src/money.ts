import type { Currency, RentalPeriod } from "./enums";
import { RENTAL_PERIOD_LABELS } from "./enums";

/**
 * Money is always handled as integer minor units (cents) plus an explicit currency.
 * Both SLE (new Leone, redenominated 2022) and USD have two decimal places.
 * Floating-point arithmetic is never used for amounts.
 */
export const CURRENCY_META: Record<Currency, { symbol: string; decimals: number; name: string }> = {
  SLE: { symbol: "Le", decimals: 2, name: "Sierra Leonean Leone" },
  USD: { symbol: "US$", decimals: 2, name: "US Dollar" },
};

export type MinorUnits = bigint;

const AMOUNT_RE = /^\d{1,13}(\.\d{1,2})?$/;

/** Parse a user-entered major-unit amount ("85,000", "1250.5") into minor units. Returns null when invalid. */
export function parseMajorToMinor(input: string | number, currency: Currency = "SLE"): MinorUnits | null {
  const decimals = CURRENCY_META[currency].decimals;
  const raw = typeof input === "number" ? input.toFixed(decimals) : input;
  const cleaned = raw.replace(/[,\s]/g, "").replace(/^(Le|US\$|\$|SLE|USD)/i, "");
  if (!AMOUNT_RE.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole!) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

/** Convert minor units back to a plain major-unit string without grouping ("85000.00" → "85000"). */
export function minorToMajorString(minor: MinorUnits | number | string, currency: Currency = "SLE"): string {
  const decimals = CURRENCY_META[currency].decimals;
  const value = BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac === 0n ? "" : "." + frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return (negative ? "-" : "") + whole.toString() + fracStr;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Format for display: "Le 85,000", "US$ 1,250.50", optionally with "/ month". */
export function formatMoney(
  minor: MinorUnits | number | string,
  currency: Currency = "SLE",
  opts: { period?: RentalPeriod | null; compact?: boolean } = {},
): string {
  const meta = CURRENCY_META[currency];
  const value = BigInt(minor);
  const base = 10n ** BigInt(meta.decimals);
  const whole = value / base;
  const frac = value % base;
  let body: string;
  if (opts.compact && whole >= 1_000_000n) {
    const tenths = Number((whole * 10n) / 1_000_000n) / 10;
    body = `${tenths}M`;
  } else {
    body = groupThousands(whole.toString());
    if (frac !== 0n) body += "." + frac.toString().padStart(meta.decimals, "0");
  }
  const suffix = opts.period ? ` / ${RENTAL_PERIOD_LABELS[opts.period]}` : "";
  return `${meta.symbol} ${body}${suffix}`;
}

/** Add amounts of the same currency. Throws on mixed currencies so no silent conversion can happen. */
export function addMoney(
  a: { amountMinor: MinorUnits; currency: Currency },
  b: { amountMinor: MinorUnits; currency: Currency },
): { amountMinor: MinorUnits; currency: Currency } {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency} without an explicit exchange rate`);
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

/** Percentage of an amount in basis points, rounded half-up, integer-only. */
export function percentOf(amountMinor: MinorUnits, basisPoints: number): MinorUnits {
  if (!Number.isInteger(basisPoints) || basisPoints < 0) throw new Error("basisPoints must be a non-negative integer");
  return (amountMinor * BigInt(basisPoints) + 5000n) / 10000n;
}
