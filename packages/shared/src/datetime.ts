import { TIMEZONE } from "./enums";

/** All timestamps are stored in UTC and rendered in Africa/Freetown (GMT, no daylight saving). */
export function formatDateTime(value: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  }).format(d);
}

export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function relativeTime(value: Date | string, now: Date = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Math.round((now.getTime() - d.getTime()) / 1000);
  const abs = Math.abs(diff);
  const fmt = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  let text: string;
  if (abs < 60) return "just now";
  if (abs < 3600) text = fmt(Math.floor(abs / 60), "minute");
  else if (abs < 86400) text = fmt(Math.floor(abs / 3600), "hour");
  else if (abs < 86400 * 30) text = fmt(Math.floor(abs / 86400), "day");
  else return formatDate(d);
  return diff >= 0 ? `${text} ago` : `in ${text}`;
}

/** Two intervals overlap when each starts before the other ends. */
export function intervalsOverlap(aStart: Date, aMinutes: number, bStart: Date, bMinutes: number): boolean {
  const aEnd = aStart.getTime() + aMinutes * 60_000;
  const bEnd = bStart.getTime() + bMinutes * 60_000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}
