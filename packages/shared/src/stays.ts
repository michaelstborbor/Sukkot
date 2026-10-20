import { z } from "zod";
import { normalizeSlPhone } from "./phone";

/**
 * Bookings of hotels, guest houses, motels and short-stay homes through Sukkot Salone.
 *
 * 1. The guest asks for dates on the booking page (REQUESTED). Bookings should be made at least
 *    `noticeDays` (7) days before check-in; later ones are allowed with a surcharge.
 * 2. Sukkot Salone staff check with the property and confirm the room (CONFIRMED), or say it is not
 *    available (UNAVAILABLE). Confirming sets a deadline to pay.
 * 3. The guest pays Sukkot Salone by mobile money or transfer (PAID once the provider or finance
 *    confirms it) and gets a receipt with the property's address, room and dates. Unpaid bookings
 *    expire at the deadline (EXPIRED).
 * 4. After the stay staff mark it COMPLETED or NO_SHOW, and record what was paid to the property.
 */

export const STAY_KINDS = ["HOTEL", "GUEST_HOUSE", "MOTEL", "SHORT_STAY_HOME"] as const;
export type StayKind = (typeof STAY_KINDS)[number];

export const STAY_KIND_LABELS: Record<StayKind, string> = {
  HOTEL: "Hotel",
  GUEST_HOUSE: "Guest house",
  MOTEL: "Motel",
  SHORT_STAY_HOME: "Short-stay home",
};
export const STAY_KIND_PLURALS: Record<StayKind, string> = {
  HOTEL: "Hotels",
  GUEST_HOUSE: "Guest houses",
  MOTEL: "Motels",
  SHORT_STAY_HOME: "Short-stay homes",
};
export const STAY_KIND_BLURBS: Record<StayKind, string> = {
  HOTEL: "Full-service hotels with a front desk, restaurant and room service.",
  GUEST_HOUSE: "Smaller, often family-run places with a host on site and breakfast.",
  MOTEL: "Easy roadside stops with parking at the door and late check-in.",
  SHORT_STAY_HOME: "Whole apartments and houses to yourself, by the night or the month.",
};
/** Whether guests book rooms (hotel, guest house, motel) or the whole place (home). */
export const stayBooksWholePlace = (kind: StayKind) => kind === "SHORT_STAY_HOME";

export const STAY_BOOKING_STATUSES = ["REQUESTED", "CONFIRMED", "PAID", "COMPLETED", "NO_SHOW", "UNAVAILABLE", "CANCELLED", "EXPIRED"] as const;
export type StayBookingStatus = (typeof STAY_BOOKING_STATUSES)[number];
export const STAY_BOOKING_STATUS_LABELS: Record<StayBookingStatus, string> = {
  REQUESTED: "Checking availability",
  CONFIRMED: "Confirmed, waiting for payment",
  PAID: "Paid and booked",
  COMPLETED: "Stay completed",
  NO_SHOW: "No-show",
  UNAVAILABLE: "Not available",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired, not paid in time",
};

export const CANCELLATION_POLICIES = ["FLEXIBLE", "MODERATE", "STRICT", "NON_REFUNDABLE"] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];
export const CANCELLATION_POLICY_LABELS: Record<CancellationPolicy, { name: string; summary: string }> = {
  FLEXIBLE: { name: "Flexible", summary: "Full refund if you cancel at least 1 day before check-in. No refund after that." },
  MODERATE: { name: "Moderate", summary: "Full refund if you cancel at least 7 days before check-in, half after that." },
  STRICT: { name: "Strict", summary: "Half refunded if you cancel at least 14 days before check-in. No refund after that." },
  NON_REFUNDABLE: { name: "Non-refundable", summary: "No refund if you cancel." },
};

/** Facilities a property can tick, by kind. The keys are stored; the labels are shown. */
export const STAY_FACILITIES: Record<StayKind, { key: string; label: string }[]> = {
  HOTEL: [
    { key: "frontDesk24h", label: "24-hour front desk" },
    { key: "restaurant", label: "Restaurant" },
    { key: "bar", label: "Bar" },
    { key: "roomService", label: "Room service" },
    { key: "pool", label: "Swimming pool" },
    { key: "gym", label: "Gym" },
    { key: "conferenceRoom", label: "Conference room" },
    { key: "airportShuttle", label: "Airport pickup (ask when booking)" },
    { key: "laundry", label: "Laundry service" },
    { key: "wifi", label: "Wi-Fi" },
    { key: "airConditioning", label: "Air conditioning" },
    { key: "backupPower", label: "24-hour power (generator or solar)" },
    { key: "parking", label: "Parking" },
    { key: "securityGuard", label: "Security guard" },
  ],
  GUEST_HOUSE: [
    { key: "hostOnSite", label: "Host lives on site" },
    { key: "sharedKitchen", label: "Kitchen guests can use" },
    { key: "sharedLounge", label: "Shared lounge or veranda" },
    { key: "laundry", label: "Laundry service" },
    { key: "wifi", label: "Wi-Fi" },
    { key: "airConditioning", label: "Air conditioning" },
    { key: "backupPower", label: "24-hour power (generator or solar)" },
    { key: "parking", label: "Parking" },
    { key: "securityGuard", label: "Security guard" },
  ],
  MOTEL: [
    { key: "driveUpParking", label: "Parking at the room door" },
    { key: "checkIn24h", label: "Check in at any hour" },
    { key: "securedParking", label: "Gated or guarded parking" },
    { key: "restaurant", label: "Restaurant or canteen" },
    { key: "wifi", label: "Wi-Fi" },
    { key: "airConditioning", label: "Air conditioning" },
    { key: "backupPower", label: "24-hour power (generator or solar)" },
  ],
  SHORT_STAY_HOME: [
    { key: "kitchen", label: "Fully equipped kitchen" },
    { key: "washingMachine", label: "Washing machine" },
    { key: "caretaker", label: "Caretaker on call" },
    { key: "cleaningService", label: "Cleaning during the stay" },
    { key: "wifi", label: "Wi-Fi" },
    { key: "airConditioning", label: "Air conditioning" },
    { key: "backupPower", label: "24-hour power (generator or solar)" },
    { key: "waterTank", label: "Water tank and pump" },
    { key: "parking", label: "Parking" },
    { key: "securityGuard", label: "Security guard" },
    { key: "workspace", label: "Desk for working" },
  ],
};

export const BREAKFAST_OPTIONS = ["INCLUDED", "EXTRA", "NONE"] as const;
export type BreakfastOption = (typeof BREAKFAST_OPTIONS)[number];
export const BREAKFAST_LABELS: Record<BreakfastOption, string> = { INCLUDED: "Breakfast included", EXTRA: "Breakfast available at extra cost", NONE: "No breakfast" };

const time = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:00");
const optionalTime = z.preprocess((v) => (v === "" || v === null ? undefined : v), time.optional());
const optionalInt = (min: number, max: number) => z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int().min(min).max(max).optional());
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * How a bookable stay works: kind, times, policy and facilities. Saved on the listing; the server
 * drops facilities that do not belong to the kind.
 */
export const stayDetailsSchema = z.object({
  kind: z.enum(STAY_KINDS),
  checkInFrom: time.default("14:00"),
  checkOutBy: time.default("12:00"),
  cancellationPolicy: z.enum(CANCELLATION_POLICIES).default("MODERATE"),
  minNights: z.coerce.number().int().min(1).max(90).default(1),
  maxNights: z.coerce.number().int().min(1).max(365).default(90),
  facilities: z.array(z.string().max(40)).max(30).default([]),
  breakfast: z.enum(BREAKFAST_OPTIONS).default("NONE"),
  /** Hotels: official star rating, if they have one. */
  starRating: optionalInt(1, 5),
  /** Guest houses: when the gate is locked at night, if it is. */
  gateClosesAt: optionalTime,
  /** Homes: a one-off cleaning charge in major units, added to each booking. */
  cleaningFee: optionalText(20),
  childrenWelcome: z.boolean().default(true),
  petsAllowed: z.boolean().default(false),
  smokingAllowed: z.boolean().default(false),
  partiesAllowed: z.boolean().default(false),
  /** Guests show a passport or national ID at check-in. */
  idRequired: z.boolean().default(true),
  houseRules: optionalText(1500),
  /** The property's own number, given to guests on their receipt once they have paid. */
  receptionPhone: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z
      .string()
      .trim()
      .refine((v) => normalizeGuestPhone(v) !== null, "Enter a phone number, e.g. 076 123 456")
      .transform((v) => normalizeGuestPhone(v)!)
      .optional(),
  ),
});
export type StayDetails = z.infer<typeof stayDetailsSchema>;

export const stayRoomTypeSchema = z.object({
  name: z.string().trim().min(2, "Name the room, e.g. Standard double").max(80),
  description: optionalText(600),
  bedType: optionalText(60),
  roomsCount: z.coerce.number().int().min(1, "At least one room").max(500).default(1),
  maxAdults: z.coerce.number().int().min(1).max(20),
  maxChildren: z.coerce.number().int().min(0).max(20).default(0),
  /** Major units, e.g. "850" for Le 850 a night. */
  nightlyPrice: z.string().trim().min(1, "Enter the price per night").max(20),
  monthlyPrice: optionalText(20),
  currency: z.enum(["SLE", "USD"]).default("SLE"),
  breakfastIncluded: z.boolean().default(false),
  features: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  isActive: z.boolean().default(true),
});

/** A phone number a guest can be reached on: Sierra Leonean, or international with the country code. */
export function normalizeGuestPhone(input: string): string | null {
  const sl = normalizeSlPhone(input);
  if (sl) return sl;
  const digits = input.replace(/[\s().-]/g, "").replace(/^00/, "+");
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

/** The questions each kind of stay asks on the booking page. */
export const stayExtrasSchema = z
  .object({
    airportPickup: z.boolean().optional(),
    flightNumber: optionalText(20),
    earlyCheckIn: z.boolean().optional(),
    lateCheckOut: z.boolean().optional(),
    extraBed: z.boolean().optional(),
    breakfast: z.boolean().optional(),
    tripPurpose: z.enum(["LEISURE", "BUSINESS", "FAMILY", "EVENT", "OTHER"]).optional(),
    vehicleRegistration: optionalText(20),
    vehicles: optionalInt(0, 10),
    agreeHouseRules: z.boolean().optional(),
  })
  .default({});
export type StayExtras = z.infer<typeof stayExtrasSchema>;
export const TRIP_PURPOSE_LABELS: Record<NonNullable<StayExtras["tripPurpose"]>, string> = { LEISURE: "Holiday or leisure", BUSINESS: "Work or business", FAMILY: "Visiting family", EVENT: "Wedding, funeral or event", OTHER: "Other" };

export const stayQuoteSchema = z.object({
  roomTypeId: z.string().min(1).max(64),
  checkIn: dateOnly,
  checkOut: dateOnly,
  rooms: z.coerce.number().int().min(1).max(10).default(1),
  adults: z.coerce.number().int().min(1).max(40).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
});

export const stayBookingRequestSchema = stayQuoteSchema.extend({
  guestName: z.string().trim().min(2, "Enter the guest's full name").max(120),
  guestPhone: z
    .string()
    .trim()
    .refine((v) => normalizeGuestPhone(v) !== null, "Enter a phone number, with the country code if it is not Sierra Leonean (e.g. +44 7700 900123)")
    .transform((v) => normalizeGuestPhone(v)!),
  guestEmail: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  guestCountry: optionalText(60),
  arrivalTime: optionalTime,
  extras: stayExtrasSchema,
  specialRequests: optionalText(1000),
  acceptPolicy: z.literal(true, { errorMap: () => ({ message: "Agree to the cancellation policy and booking terms" }) }),
});
export type StayBookingRequest = z.infer<typeof stayBookingRequestSchema>;

/* -------------------------------------------------------------- Dates and money */

const DAY_MS = 86_400_000;

/** "2026-11-03" → midnight UTC (Freetown is on GMT all year). */
export function parseStayDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}
export const stayDateString = (d: Date) => d.toISOString().slice(0, 10);
/** Today's date in Freetown, at midnight. */
export const stayToday = (now: Date = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
export const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

export interface StayPriceInput {
  nightlyMinor: bigint;
  /** Price for 30 nights, when offered. */
  monthlyMinor: bigint | null;
  nights: number;
  rooms: number;
  /** Days from today to check-in. */
  leadDays: number;
  noticeDays: number;
  surchargePercent: number;
  cleaningFeeMinor: bigint;
}

export interface StayPrice {
  basis: "NIGHTLY" | "MONTHLY";
  /** One line per part of the price, for the guest to read. */
  lines: { label: string; amountMinor: bigint }[];
  stayMinor: bigint;
  isLate: boolean;
  lateFeeMinor: bigint;
  cleaningFeeMinor: bigint;
  totalMinor: bigint;
}

/**
 * Price a stay. With a monthly rate, each full 30 nights costs the monthly rate and the nights left
 * over cost the nightly rate, never more than another month. A booking made less than `noticeDays`
 * before check-in costs `surchargePercent` more (rounded to the nearest minor unit).
 */
export function priceStay(i: StayPriceInput): StayPrice {
  const lines: StayPrice["lines"] = [];
  let perRoom: bigint;
  let basis: StayPrice["basis"] = "NIGHTLY";
  if (i.monthlyMinor && i.nights >= 28) {
    basis = "MONTHLY";
    const months = Math.floor(i.nights / 30);
    const rest = i.nights % 30;
    const restMinor = BigInt(rest) * i.nightlyMinor;
    const restCost = restMinor < i.monthlyMinor ? restMinor : i.monthlyMinor;
    perRoom = BigInt(months) * i.monthlyMinor + restCost;
    if (months) lines.push({ label: `${months} month${months === 1 ? "" : "s"} (30 nights each) at the monthly rate`, amountMinor: BigInt(months) * i.monthlyMinor * BigInt(i.rooms) });
    if (rest) lines.push({ label: restCost < restMinor ? `${rest}${months ? " more" : ""} night${rest === 1 ? "" : "s"}, capped at the monthly rate` : `${rest} night${rest === 1 ? "" : "s"} at the nightly rate`, amountMinor: restCost * BigInt(i.rooms) });
  } else {
    perRoom = BigInt(i.nights) * i.nightlyMinor;
    lines.push({ label: `${i.nights} night${i.nights === 1 ? "" : "s"} at the nightly rate`, amountMinor: perRoom * BigInt(i.rooms) });
  }
  if (i.rooms > 1) for (const l of lines) l.label += ` × ${i.rooms} rooms`;
  const stayMinor = perRoom * BigInt(i.rooms);
  const isLate = i.leadDays < i.noticeDays;
  const lateFeeMinor = isLate && i.surchargePercent > 0 ? (stayMinor * BigInt(Math.round(i.surchargePercent * 100)) + 5000n) / 10000n : 0n;
  if (lateFeeMinor > 0n) lines.push({ label: `Late booking charge (${i.surchargePercent}%, booked less than ${i.noticeDays} days ahead)`, amountMinor: lateFeeMinor });
  if (i.cleaningFeeMinor > 0n) lines.push({ label: "Cleaning fee", amountMinor: i.cleaningFeeMinor });
  return { basis, lines, stayMinor, isLate, lateFeeMinor, cleaningFeeMinor: i.cleaningFeeMinor, totalMinor: stayMinor + lateFeeMinor + i.cleaningFeeMinor };
}

/**
 * What a guest gets back when they cancel a paid booking `daysBefore` days before check-in. The
 * policy applies to the stay and cleaning fee; the late booking charge is not refunded.
 */
export function stayRefundDue(policy: CancellationPolicy, refundableMinor: bigint, daysBefore: number): bigint {
  const half = refundableMinor / 2n;
  switch (policy) {
    case "FLEXIBLE":
      return daysBefore >= 1 ? refundableMinor : 0n;
    case "MODERATE":
      return daysBefore >= 7 ? refundableMinor : half;
    case "STRICT":
      return daysBefore >= 14 ? half : 0n;
    case "NON_REFUNDABLE":
      return 0n;
  }
}
