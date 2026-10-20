import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  CANCELLATION_POLICY_LABELS,
  STAY_BOOKING_STATUS_LABELS,
  STAY_FACILITIES,
  STAY_KIND_LABELS,
  daysBetween,
  formatDateTime,
  formatMoney,
  minorToMajorString,
  parseMajorToMinor,
  parseStayDate,
  priceStay,
  stayBookingRequestSchema,
  stayBooksWholePlace,
  stayDetailsSchema,
  stayQuoteSchema,
  stayRefundDue,
  stayRoomTypeSchema,
  stayToday,
  type StayDetails,
  type StayKind,
} from "@sukkot/shared";
import type { Currency, Prisma, StayBooking, StayBookingStatus } from "@prisma/client";
import { db, type Tx } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor, assertPermission, can } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";
import { getSetting } from "./settings";
import { locationChain, locationParts } from "./properties";

/**
 * Hotels, guest houses, motels and short-stay homes that take bookings through Sukkot Salone (see the
 * protocol in @sukkot/shared `stays.ts`). A listing becomes bookable when it is a published short-stay
 * listing with a stay kind, at least one room type, and either the listing fee paid or bookings opened
 * by staff under an agreement with the property's management.
 *
 * Guests pay Sukkot Salone; Sukkot Salone pays the property and records each payout here, so every
 * booking shows what came in, what went back to the guest and what went to the property.
 */

/** Statuses in which a booking still holds the guest's dates. */
const OPEN: StayBookingStatus[] = ["REQUESTED", "CONFIRMED", "PAID"];
/** Statuses after which the guest's money is with Sukkot Salone. */
const PAID_STATES: StayBookingStatus[] = ["PAID", "COMPLETED", "NO_SHOW"];

const HOUR = 3_600_000;

export function newBookingReference() {
  return `BK-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

/** The saved stay details, or null when the listing has none or they no longer validate. */
export function readStayDetails(raw: Prisma.JsonValue | null | undefined): StayDetails | null {
  if (!raw) return null;
  const parsed = stayDetailsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function staffToTell(tx: Tx | typeof db = db) {
  const rows = await tx.userRoleAssignment.findMany({ where: { role: { in: ["MODERATOR", "SUPPORT", "SUPER_ADMIN"] }, user: { status: "ACTIVE" } }, select: { userId: true }, distinct: ["userId"] });
  return rows.map((r) => r.userId);
}
async function financeToTell(tx: Tx | typeof db = db) {
  const rows = await tx.userRoleAssignment.findMany({ where: { role: { in: ["FINANCE", "SUPER_ADMIN"] }, user: { status: "ACTIVE" } }, select: { userId: true }, distinct: ["userId"] });
  return rows.map((r) => r.userId);
}

/* ------------------------------------------------------------------ Setting up a stay */

const stayPropertySelect = {
  id: true,
  title: true,
  slug: true,
  reference: true,
  listerId: true,
  ownerId: true,
  purpose: true,
  listingStatus: true,
  availability: true,
  stayKind: true,
  stayDetails: true,
  stayListingPaidAt: true,
  stayArrangedAt: true,
  stayCommissionBps: true,
  currency: true,
  isDemo: true,
} satisfies Prisma.PropertySelect;

async function loadManagedStay(actor: Actor, propertyId: string) {
  const p = await db.property.findUnique({ where: { id: propertyId }, select: stayPropertySelect });
  if (!p) throw notFound("Listing");
  if (p.listerId !== actor.id && p.ownerId !== actor.id && !can(actor, "admin:bookings.manage")) throw notFound("Listing");
  return p;
}

/** Whether a listing takes bookings now, and if not, what is missing. */
export async function stayBookingState(p: { purpose: string; listingStatus: string; availability: string; stayKind: StayKind | null; stayListingPaidAt: Date | null; stayArrangedAt: Date | null }, activeRooms: number) {
  const fee = await getSetting("stay.listingFee");
  const feeSettled = !!p.stayListingPaidAt || !!p.stayArrangedAt || !fee;
  const missing: string[] = [];
  if (p.purpose !== "SHORT_STAY") missing.push("List it as a short stay");
  if (!p.stayKind) missing.push("Choose what kind of place it is");
  if (!activeRooms) missing.push("Add at least one room with its price");
  if (!feeSettled) missing.push(`Pay the ${formatMoney(BigInt(fee!.priceMinor), fee!.currency)} listing fee`);
  if (p.listingStatus !== "PUBLISHED") missing.push("Get the listing approved and published");
  if (p.availability !== "AVAILABLE") missing.push("Mark the listing available");
  return { bookable: missing.length === 0, missing, feeSettled, fee };
}

/** Everything the setup page needs for one listing. */
export async function getStaySetup(actorIn: Actor | null, propertyId: string) {
  const actor = assertActor(actorIn);
  const p = await loadManagedStay(actor, propertyId);
  const rooms = await db.stayRoomType.findMany({ where: { propertyId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const state = await stayBookingState(p, rooms.filter((r) => r.isActive).length);
  return { property: p, details: readStayDetails(p.stayDetails), rooms, ...state };
}

/** The lister (or staff) say what kind of stay it is and how it works. */
export async function saveStayDetails(actorIn: Actor | null, propertyId: string, input: unknown, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const p = await loadManagedStay(actor, propertyId);
  if (p.purpose !== "SHORT_STAY") throw new AppError("CONFLICT", "Only listings offered as a short stay can take bookings. Change the listing to Short stay first.");
  const data = stayDetailsSchema.parse(input);
  const allowed = new Set(STAY_FACILITIES[data.kind].map((f) => f.key));
  data.facilities = [...new Set(data.facilities)].filter((f) => allowed.has(f));
  if (data.cleaningFee !== undefined) {
    const minor = parseMajorToMinor(data.cleaningFee, p.currency);
    if (minor === null || minor < 0n) throw new AppError("VALIDATION", "Enter the cleaning fee as a number", { cleaningFee: "Numbers only" });
  }
  if (data.kind !== "SHORT_STAY_HOME") data.cleaningFee = undefined;
  if (data.maxNights < data.minNights) throw new AppError("VALIDATION", "The longest stay must be at least the shortest", { maxNights: "Too short" });
  if (stayBooksWholePlace(data.kind) && (await db.stayRoomType.count({ where: { propertyId, isActive: true } })) > 1) {
    throw new AppError("CONFLICT", "A short-stay home is booked as a whole, so it can have only one set of prices. Switch off the extra rooms first.");
  }
  const updated = await db.property.update({ where: { id: propertyId }, data: { stayKind: data.kind, stayDetails: data as unknown as Prisma.InputJsonValue } });
  await audit({ actorId: actor.id, action: "stay.details_save", targetType: "Property", targetId: propertyId, metadata: { kind: data.kind }, ipHash });
  return { kind: updated.stayKind, details: data };
}

function roomData(data: z.infer<typeof stayRoomTypeSchema>) {
  const nightly = parseMajorToMinor(data.nightlyPrice, data.currency);
  if (!nightly || nightly <= 0n) throw new AppError("VALIDATION", "Enter the price per night", { nightlyPrice: "Numbers only" });
  const monthly = data.monthlyPrice ? parseMajorToMinor(data.monthlyPrice, data.currency) : null;
  if (data.monthlyPrice && (!monthly || monthly <= 0n)) throw new AppError("VALIDATION", "Enter the price per month as a number", { monthlyPrice: "Numbers only" });
  return {
    name: data.name,
    description: data.description ?? null,
    bedType: data.bedType ?? null,
    roomsCount: data.roomsCount,
    maxAdults: data.maxAdults,
    maxChildren: data.maxChildren,
    nightlyPriceMinor: nightly,
    monthlyPriceMinor: monthly,
    currency: data.currency,
    breakfastIncluded: data.breakfastIncluded,
    features: data.features,
    isActive: data.isActive,
  };
}

export async function addRoomType(actorIn: Actor | null, propertyId: string, input: unknown, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const p = await loadManagedStay(actor, propertyId);
  const data = roomData(stayRoomTypeSchema.parse(input));
  if (p.stayKind && stayBooksWholePlace(p.stayKind)) {
    if (await db.stayRoomType.count({ where: { propertyId, isActive: true } })) throw new AppError("CONFLICT", "A short-stay home has one set of prices. Edit the one you have.");
    data.roomsCount = 1;
  }
  const count = await db.stayRoomType.count({ where: { propertyId } });
  if (count >= 30) throw new AppError("CONFLICT", "A listing can have up to 30 room types");
  const room = await db.stayRoomType.create({ data: { ...data, propertyId, sortOrder: count } });
  await audit({ actorId: actor.id, action: "stay.room_add", targetType: "StayRoomType", targetId: room.id, metadata: { propertyId }, ipHash });
  return room;
}

export async function updateRoomType(actorIn: Actor | null, propertyId: string, roomId: string, input: unknown, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const p = await loadManagedStay(actor, propertyId);
  const existing = await db.stayRoomType.findFirst({ where: { id: roomId, propertyId } });
  if (!existing) throw notFound("Room");
  const data = roomData(stayRoomTypeSchema.parse(input));
  if (p.stayKind && stayBooksWholePlace(p.stayKind)) {
    data.roomsCount = 1;
    if (data.isActive && !existing.isActive && (await db.stayRoomType.count({ where: { propertyId, isActive: true } }))) throw new AppError("CONFLICT", "A short-stay home has one set of prices. Switch the other one off first.");
  }
  // Prices already quoted to guests stay as they were; the new price applies to new bookings.
  const room = await db.stayRoomType.update({ where: { id: roomId }, data });
  await audit({ actorId: actor.id, action: "stay.room_update", targetType: "StayRoomType", targetId: roomId, metadata: { propertyId }, ipHash });
  return room;
}

/** Remove a room type nobody has booked; one with bookings is switched off instead. */
export async function removeRoomType(actorIn: Actor | null, propertyId: string, roomId: string, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  await loadManagedStay(actor, propertyId);
  const existing = await db.stayRoomType.findFirst({ where: { id: roomId, propertyId }, include: { _count: { select: { bookings: true } } } });
  if (!existing) throw notFound("Room");
  if (existing._count.bookings) await db.stayRoomType.update({ where: { id: roomId }, data: { isActive: false } });
  else await db.stayRoomType.delete({ where: { id: roomId } });
  await audit({ actorId: actor.id, action: "stay.room_remove", targetType: "StayRoomType", targetId: roomId, metadata: { propertyId, kept: existing._count.bookings > 0 }, ipHash });
  return { removed: existing._count.bookings === 0 };
}

const arrangeSchema = z.object({
  open: z.boolean(),
  commissionPercent: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(0).max(50).optional()),
});

/**
 * Staff open a listing for bookings under an agreement with the property's management (no listing
 * fee), and record the commission agreed. Closing it again stops new bookings; open ones carry on.
 */
export async function arrangeStay(actorIn: Actor | null, propertyId: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:bookings.manage");
  const data = arrangeSchema.parse(input);
  const p = await db.property.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!p) throw notFound("Listing");
  const updated = await db.property.update({
    where: { id: propertyId },
    data: { stayArrangedAt: data.open ? new Date() : null, ...(data.commissionPercent !== undefined ? { stayCommissionBps: Math.round(data.commissionPercent * 100) } : {}) },
    select: { stayArrangedAt: true, stayCommissionBps: true },
  });
  await audit({ actorId: actor.id, action: data.open ? "stay.arrange" : "stay.unarrange", targetType: "Property", targetId: propertyId, metadata: { commissionBps: updated.stayCommissionBps }, ipHash });
  return updated;
}

/* --------------------------------------------------------------------------- Browsing */

const roomPublicSelect = {
  id: true,
  name: true,
  description: true,
  bedType: true,
  roomsCount: true,
  maxAdults: true,
  maxChildren: true,
  nightlyPriceMinor: true,
  monthlyPriceMinor: true,
  currency: true,
  breakfastIncluded: true,
  features: true,
} satisfies Prisma.StayRoomTypeSelect;

/** A bookable stay for its booking page, or null when it does not take bookings. */
export async function getBookableStay(slug: string) {
  const p = await db.property.findUnique({
    where: { slug },
    select: {
      ...stayPropertySelect,
      addressLine: true,
      description: true,
      location: locationChain,
      images: { orderBy: { sortOrder: "asc" }, take: 6, select: { storageKey: true, alt: true } },
      stayRooms: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: roomPublicSelect },
    },
  });
  if (!p || !p.stayKind) return null;
  const details = readStayDetails(p.stayDetails);
  if (!details) return null;
  const state = await stayBookingState(p, p.stayRooms.length);
  return { ...p, details, kind: p.stayKind, locationLabel: locationParts(p.location).label, ...state };
}

/** Just enough to show "Book your stay" on a listing page. */
export async function stayTeaser(propertyId: string) {
  const p = await db.property.findUnique({ where: { id: propertyId }, select: { ...stayPropertySelect, stayRooms: { where: { isActive: true }, select: { nightlyPriceMinor: true, currency: true } } } });
  if (!p?.stayKind) return null;
  const details = readStayDetails(p.stayDetails);
  if (!details) return null;
  const state = await stayBookingState(p, p.stayRooms.length);
  if (!state.bookable) return null;
  const cheapest = [...p.stayRooms].sort((a, b) => (a.nightlyPriceMinor < b.nightlyPriceMinor ? -1 : 1))[0]!;
  return { kind: p.stayKind, details, fromNightly: formatMoney(cheapest.nightlyPriceMinor, cheapest.currency), slug: p.slug };
}

/** Published listings that take bookings, cheapest room first, optionally of one kind. */
export async function listBookableStays(kind?: StayKind) {
  const fee = await getSetting("stay.listingFee");
  const rows = await db.property.findMany({
    where: {
      listingStatus: "PUBLISHED",
      purpose: "SHORT_STAY",
      availability: "AVAILABLE",
      stayKind: kind ? kind : { not: null },
      stayRooms: { some: { isActive: true } },
      ...(fee ? { OR: [{ stayListingPaidAt: { not: null } }, { stayArrangedAt: { not: null } }] } : {}),
    },
    select: { id: true, stayKind: true, stayDetails: true, stayRooms: { where: { isActive: true }, select: { nightlyPriceMinor: true, currency: true } } },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: 120,
  });
  return rows
    .map((r) => {
      const cheapest = [...r.stayRooms].sort((a, b) => (a.nightlyPriceMinor < b.nightlyPriceMinor ? -1 : 1))[0]!;
      return { id: r.id, kind: r.stayKind!, details: readStayDetails(r.stayDetails), fromNightly: formatMoney(cheapest.nightlyPriceMinor, cheapest.currency), rooms: r.stayRooms.length };
    })
    .filter((r) => r.details);
}

/* ----------------------------------------------------------------- Quotes and booking */

async function quoteFor(propertyId: string, input: unknown) {
  const data = stayQuoteSchema.parse(input);
  const stay = await db.property.findUnique({ where: { id: propertyId }, select: { ...stayPropertySelect, stayRooms: { where: { isActive: true }, select: { id: true } } } });
  if (!stay || !stay.stayKind) throw notFound("Stay");
  const details = readStayDetails(stay.stayDetails);
  const state = await stayBookingState(stay, stay.stayRooms.length);
  if (!details || !state.bookable) throw new AppError("CONFLICT", "This place is not taking bookings through Sukkot Salone right now");
  const room = await db.stayRoomType.findFirst({ where: { id: data.roomTypeId, propertyId, isActive: true } });
  if (!room) throw new AppError("VALIDATION", "Choose a room", { roomTypeId: "Choose a room" });

  const checkIn = parseStayDate(data.checkIn);
  const checkOut = parseStayDate(data.checkOut);
  if (!checkIn) throw new AppError("VALIDATION", "Choose the check-in date", { checkIn: "Choose a date" });
  if (!checkOut) throw new AppError("VALIDATION", "Choose the check-out date", { checkOut: "Choose a date" });
  const today = stayToday();
  const leadDays = daysBetween(today, checkIn);
  if (leadDays < 0) throw new AppError("VALIDATION", "Check-in cannot be in the past", { checkIn: "In the past" });
  if (leadDays > 365) throw new AppError("VALIDATION", "Bookings open up to a year ahead", { checkIn: "Too far ahead" });
  const nights = daysBetween(checkIn, checkOut);
  if (nights < 1) throw new AppError("VALIDATION", "Check-out must be after check-in", { checkOut: "After check-in" });
  if (nights < details.minNights) throw new AppError("VALIDATION", `The shortest stay here is ${details.minNights} nights`, { checkOut: `At least ${details.minNights} nights` });
  if (nights > details.maxNights) throw new AppError("VALIDATION", `The longest stay here is ${details.maxNights} nights`, { checkOut: `At most ${details.maxNights} nights` });

  const whole = stayBooksWholePlace(stay.stayKind);
  const rooms = whole ? 1 : data.rooms;
  if (rooms > room.roomsCount) throw new AppError("VALIDATION", `There ${room.roomsCount === 1 ? "is 1 room" : `are ${room.roomsCount} rooms`} of this kind`, { rooms: `At most ${room.roomsCount}` });
  if (data.adults > room.maxAdults * rooms) throw new AppError("VALIDATION", `${whole ? "This place" : rooms === 1 ? "This room" : "These rooms"} sleep${whole || rooms > 1 ? "" : "s"} up to ${room.maxAdults * rooms} adults`, { adults: `At most ${room.maxAdults * rooms}` });
  if (data.children > 0 && !details.childrenWelcome) throw new AppError("VALIDATION", "This place does not take children", { children: "Not allowed" });
  if (data.children > room.maxChildren * rooms) throw new AppError("VALIDATION", `Up to ${room.maxChildren * rooms} children`, { children: `At most ${room.maxChildren * rooms}` });

  const late = await getSetting("stay.lateBooking");
  const cleaningFeeMinor = whole && details.cleaningFee ? (parseMajorToMinor(details.cleaningFee, room.currency) ?? 0n) : 0n;
  const price = priceStay({ nightlyMinor: room.nightlyPriceMinor, monthlyMinor: room.monthlyPriceMinor, nights, rooms, leadDays, noticeDays: late.noticeDays, surchargePercent: late.surchargePercent, cleaningFeeMinor });
  return { stay, details, room, data: { ...data, rooms }, checkIn, checkOut, nights, leadDays, price, late, currency: room.currency as Currency };
}

/** The price of a stay, for the booking page to show before the guest asks. */
export async function quoteStay(propertyId: string, input: unknown) {
  const q = await quoteFor(propertyId, input);
  return {
    nights: q.nights,
    rooms: q.data.rooms,
    isLate: q.price.isLate,
    noticeDays: q.late.noticeDays,
    basis: q.price.basis,
    lines: q.price.lines.map((l) => ({ label: l.label, amount: formatMoney(l.amountMinor, q.currency) })),
    total: formatMoney(q.price.totalMinor, q.currency),
    totalMinor: q.price.totalMinor.toString(),
    currency: q.currency,
  };
}

/** Questions each kind of stay must have answered before the request goes in. */
function checkExtras(kind: StayKind, details: StayDetails, data: z.infer<typeof stayBookingRequestSchema>) {
  const e = data.extras;
  if (kind === "SHORT_STAY_HOME" && !e.agreeHouseRules) throw new AppError("VALIDATION", "Agree to the house rules", { "extras.agreeHouseRules": "Required" });
  if (e.airportPickup && !details.facilities.includes("airportShuttle")) e.airportPickup = undefined;
  if (!e.airportPickup) e.flightNumber = undefined;
  if (e.breakfast && details.breakfast !== "EXTRA") e.breakfast = undefined;
  if (kind !== "MOTEL") e.vehicleRegistration = undefined;
  if (kind !== "SHORT_STAY_HOME") e.agreeHouseRules = undefined;
  if (kind === "SHORT_STAY_HOME") e.extraBed = undefined;
}

/**
 * A signed-in guest asks for a stay. Nothing is charged: staff check with the property first, then the
 * guest is asked to pay.
 */
export async function requestStayBooking(actorIn: Actor | null, propertyId: string, input: unknown, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const data = stayBookingRequestSchema.parse(input);
  const q = await quoteFor(propertyId, data);
  if (q.stay.listerId === actor.id || q.stay.ownerId === actor.id) throw new AppError("CONFLICT", "You cannot book your own listing");
  checkExtras(q.stay.stayKind!, q.details, data);
  const duplicate = await db.stayBooking.findFirst({
    where: { guestId: actor.id, roomTypeId: q.room.id, checkIn: q.checkIn, checkOut: q.checkOut, status: { in: ["REQUESTED", "CONFIRMED"] } },
    select: { reference: true },
  });
  if (duplicate) throw new AppError("CONFLICT", `You have already asked for these dates (booking ${duplicate.reference})`);
  const open = await db.stayBooking.count({ where: { guestId: actor.id, status: "REQUESTED" } });
  if (open >= 5) throw new AppError("CONFLICT", "You have 5 bookings waiting for an answer. Wait for those, or cancel one, before asking for more.");

  const kindLabel = STAY_KIND_LABELS[q.stay.stayKind!].toLowerCase();
  return db.$transaction(async (tx) => {
    const booking = await tx.stayBooking.create({
      data: {
        reference: newBookingReference(),
        propertyId,
        roomTypeId: q.room.id,
        guestId: actor.id,
        checkIn: q.checkIn,
        checkOut: q.checkOut,
        nights: q.nights,
        rooms: q.data.rooms,
        adults: q.data.adults,
        children: q.data.children,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestEmail: data.guestEmail,
        guestCountry: data.guestCountry ?? null,
        arrivalTime: data.arrivalTime ?? null,
        extras: data.extras as Prisma.InputJsonValue,
        specialRequests: data.specialRequests ?? null,
        leadDays: q.leadDays,
        isLate: q.price.isLate,
        priceBreakdown: { basis: q.price.basis, lines: q.price.lines.map((l) => ({ label: l.label, amountMinor: l.amountMinor.toString() })) },
        stayAmountMinor: q.price.stayMinor,
        lateFeeMinor: q.price.lateFeeMinor,
        cleaningFeeMinor: q.price.cleaningFeeMinor,
        totalMinor: q.price.totalMinor,
        currency: q.currency,
        cancellationPolicy: q.details.cancellationPolicy,
      },
    });
    const when = `${booking.checkIn.toISOString().slice(0, 10)} to ${booking.checkOut.toISOString().slice(0, 10)}`;
    await notify(
      [
        ...(await staffToTell(tx)).map((userId) => ({
          userId,
          type: "stay.requested",
          title: `${q.price.isLate ? "Late booking" : "Booking"} to check: ${booking.reference}`,
          body: `${data.guestName} asks for ${q.data.rooms > 1 ? `${q.data.rooms} × ` : ""}${q.room.name} at ${kindLabel} ${q.stay.title} (${q.stay.reference}), ${when}, ${q.nights} night${q.nights === 1 ? "" : "s"}, ${q.data.adults} adult${q.data.adults === 1 ? "" : "s"}${q.data.children ? ` and ${q.data.children} children` : ""}. Total ${formatMoney(q.price.totalMinor, q.currency)}. Check availability with the property and confirm it.`,
          link: "/admin/stays",
          email: true,
        })),
        {
          userId: actor.id,
          type: "stay.requested",
          title: `Booking request sent: ${booking.reference}`,
          body: `We are checking with ${q.stay.title} that ${q.room.name.toLowerCase()} is free from ${when}. We will tell you as soon as they confirm, and then ask you to pay ${formatMoney(q.price.totalMinor, q.currency)}. Nothing is charged until then.`,
          link: `/dashboard/stays/${booking.reference}`,
          email: true,
        },
      ],
      tx,
    );
    await audit({ actorId: actor.id, action: "stay.request", targetType: "StayBooking", targetId: booking.id, metadata: { reference: booking.reference, propertyId, late: q.price.isLate }, ipHash }, tx);
    return booking;
  });
}

/* ------------------------------------------------------------------- Guest's bookings */

const bookingInclude = {
  property: { select: { id: true, title: true, slug: true, reference: true, addressLine: true, stayKind: true, stayDetails: true, location: locationChain } },
  roomType: { select: { name: true, bedType: true, breakfastIncluded: true } },
  guest: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  payments: { orderBy: { createdAt: "desc" }, select: { id: true, reference: true, status: true, method: true, providerVerified: true, amountMinor: true, currency: true, externalReference: true, paidAt: true, providerData: true, createdAt: true } },
} satisfies Prisma.StayBookingInclude;
export type BookingRow = Prisma.StayBookingGetPayload<{ include: typeof bookingInclude }>;

/** Move confirmed bookings that were not paid by their deadline to EXPIRED. Transfers waiting for a finance check hold the booking. */
export async function expireStayBookings(now = new Date()) {
  const due = await db.stayBooking.findMany({
    where: { status: "CONFIRMED", paymentDueAt: { lt: now }, payments: { none: { status: { in: ["PENDING", "CREATED"] } } } },
    select: { id: true, reference: true, guestId: true, property: { select: { title: true } } },
    take: 200,
  });
  for (const b of due) {
    await db.$transaction(async (tx) => {
      const moved = await tx.stayBooking.updateMany({ where: { id: b.id, status: "CONFIRMED" }, data: { status: "EXPIRED" } });
      if (!moved.count) return;
      await notify([{ userId: b.guestId, type: "stay.expired", title: `Booking ${b.reference} expired`, body: `We did not receive payment for your stay at ${b.property.title} in time, so the room has been released. You can ask for the dates again.`, link: `/dashboard/stays/${b.reference}`, email: true }], tx);
    });
  }
  return due.length;
}

export async function myStayBookings(actorIn: Actor | null) {
  const actor = assertActor(actorIn);
  await expireStayBookings();
  return db.stayBooking.findMany({ where: { guestId: actor.id }, include: bookingInclude, orderBy: { createdAt: "desc" }, take: 100 });
}

/** One booking, for its guest or for staff. */
export async function getStayBooking(actorIn: Actor | null, reference: string) {
  const actor = assertActor(actorIn);
  await expireStayBookings();
  const b = await db.stayBooking.findUnique({ where: { reference }, include: bookingInclude });
  if (!b || (b.guestId !== actor.id && !can(actor, "admin:bookings.manage"))) throw notFound("Booking");
  return b;
}

/** The confirmed payment for a booking: provider-verified, or checked by finance. */
export const confirmedPayment = (b: Pick<BookingRow, "payments">) => b.payments.find((p) => (p.status === "SUCCEEDED" && p.providerVerified) || p.status === "RECORDED" || p.status === "REFUNDED") ?? null;
/** A transfer the guest sent that finance has not checked yet. */
export const paymentAwaitingCheck = (b: Pick<BookingRow, "payments">) => b.payments.find((p) => p.status === "PENDING" || p.status === "CREATED") ?? null;

/** What the guest would get back if they cancelled now. */
export function guestRefundIfCancelled(b: Pick<StayBooking, "status" | "cancellationPolicy" | "totalMinor" | "lateFeeMinor" | "checkIn">, now = new Date()) {
  if (b.status !== "PAID") return 0n;
  return stayRefundDue(b.cancellationPolicy, b.totalMinor - b.lateFeeMinor, daysBetween(stayToday(now), b.checkIn));
}

const reasonSchema = z.object({ reason: z.string().trim().max(500).optional().transform((v) => v || undefined) });

/**
 * The guest cancels. Before payment nothing is owed. After payment the cancellation policy decides the
 * refund, which finance sends back and records. From the check-in day on, guests ask our team instead.
 */
export async function cancelStayByGuest(actorIn: Actor | null, reference: string, input: unknown, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const { reason } = reasonSchema.parse(input);
  const b = await db.stayBooking.findUnique({ where: { reference }, include: { property: { select: { title: true } } } });
  if (!b || b.guestId !== actor.id) throw notFound("Booking");
  if (!OPEN.includes(b.status)) throw new AppError("CONFLICT", "This booking is already closed");
  if (b.status === "PAID" && daysBetween(stayToday(), b.checkIn) < 1) throw new AppError("CONFLICT", "It is the day of check-in or later. Call or WhatsApp our team to change or cancel this stay.");
  const pending = await db.paymentTransaction.count({ where: { stayBookingId: b.id, status: { in: ["PENDING", "CREATED"] } } });
  if (pending) throw new AppError("CONFLICT", "We are still checking a payment you sent for this booking. Wait for that, or call our team.");
  const refund = guestRefundIfCancelled(b);
  return db.$transaction(async (tx) => {
    const moved = await tx.stayBooking.updateMany({ where: { id: b.id, status: b.status }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "GUEST", cancelReason: reason ?? null, refundDueMinor: b.status === "PAID" ? refund : null } });
    if (!moved.count) throw new AppError("CONFLICT", "This booking changed. Reload and try again.");
    const money = b.status === "PAID" ? (refund > 0n ? ` Under the ${CANCELLATION_POLICY_LABELS[b.cancellationPolicy].name.toLowerCase()} cancellation policy we will send back ${formatMoney(refund, b.currency)}.` : " Under the cancellation policy no refund is due.") : "";
    await notify(
      [
        { userId: actor.id, type: "stay.cancelled", title: `Booking ${b.reference} cancelled`, body: `You cancelled your stay at ${b.property.title}.${money}`, link: `/dashboard/stays/${b.reference}`, email: true },
        ...(await staffToTell(tx)).map((userId) => ({ userId, type: "stay.cancelled", title: `Guest cancelled ${b.reference}`, body: `The guest cancelled their ${STAY_BOOKING_STATUS_LABELS[b.status].toLowerCase()} booking at ${b.property.title}. Tell the property.${b.status === "PAID" ? ` Refund due: ${formatMoney(refund, b.currency)}.` : ""}`, link: "/admin/stays?status=CANCELLED" })),
        ...(b.status === "PAID" && refund > 0n ? (await financeToTell(tx)).map((userId) => ({ userId, type: "stay.refund_due", title: `Refund due: ${b.reference}`, body: `Send ${formatMoney(refund, b.currency)} back to the guest and record it in Bookings.`, link: "/admin/stays?status=CANCELLED" })) : []),
      ],
      tx,
    );
    await audit({ actorId: actor.id, action: "stay.cancel_guest", targetType: "StayBooking", targetId: b.id, metadata: { refundMinor: refund.toString() }, ipHash }, tx);
    return { refundDue: formatMoney(refund, b.currency) };
  });
}

/* ------------------------------------------------------------------------ Staff work */

export async function listStayBookings(actorIn: Actor | null, status?: string) {
  assertPermission(actorIn, "admin:bookings.manage");
  await expireStayBookings();
  const where: Prisma.StayBookingWhereInput =
    status === "ALL"
      ? {}
      : status === "PAID"
        ? { status: "PAID" }
        : status === "DONE"
          ? { status: { in: ["COMPLETED", "NO_SHOW"] } }
          : status === "CANCELLED"
            ? { status: { in: ["CANCELLED", "UNAVAILABLE", "EXPIRED"] } }
            : { status: { in: ["REQUESTED", "CONFIRMED"] } };
  return db.stayBooking.findMany({ where, include: bookingInclude, orderBy: status === "PAID" ? { checkIn: "asc" } : { createdAt: "asc" }, take: 200 });
}

async function loadForStaff(id: string) {
  const b = await db.stayBooking.findUnique({ where: { id }, include: { property: { select: { title: true, stayCommissionBps: true } }, roomType: { select: { name: true } } } });
  if (!b) throw notFound("Booking");
  return b;
}

const confirmSchema = z.object({
  propertyConfirmation: z.string().trim().min(3, "Say who at the property confirmed, or their booking number").max(200),
  roomNumber: z.string().trim().max(40).optional().transform((v) => v || undefined),
  payWithinHours: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().min(1).max(168).optional()),
  note: z.string().trim().max(1000).optional().transform((v) => v || undefined),
});

/**
 * Staff have checked with the property and the room is held: the guest is asked to pay within 48
 * hours (12 for late bookings), and never later than midday on the check-in day.
 */
export async function confirmStayBooking(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:bookings.manage");
  const data = confirmSchema.parse(input);
  const b = await loadForStaff(id);
  if (b.status !== "REQUESTED") throw new AppError("CONFLICT", "Only a booking waiting for an answer can be confirmed");
  const now = Date.now();
  const hours = data.payWithinHours ?? (b.isLate ? 12 : 48);
  const latest = b.checkIn.getTime() + 12 * HOUR;
  const due = new Date(Math.max(now + HOUR, Math.min(now + hours * HOUR, latest)));
  return db.$transaction(async (tx) => {
    const moved = await tx.stayBooking.updateMany({
      where: { id, status: "REQUESTED" },
      data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById: actor.id, propertyConfirmation: data.propertyConfirmation, roomNumber: data.roomNumber ?? null, staffNote: data.note ?? null, paymentDueAt: due },
    });
    if (!moved.count) throw new AppError("CONFLICT", "This booking changed. Reload and try again.");
    await notify(
      [{ userId: b.guestId, type: "stay.confirmed", title: `${b.property.title} confirmed your stay: pay by ${formatDateTime(due)}`, body: `Good news: ${b.property.title} has your ${b.roomType.name.toLowerCase()} for ${b.nights} night${b.nights === 1 ? "" : "s"}. Pay ${formatMoney(b.totalMinor, b.currency)} to Sukkot Salone by ${formatDateTime(due)} to secure it, by mobile money or transfer.${data.note ? ` ${data.note}` : ""}`, link: `/dashboard/stays/${b.reference}`, email: true }],
      tx,
    );
    await audit({ actorId: actor.id, action: "stay.confirm", targetType: "StayBooking", targetId: id, metadata: { propertyConfirmation: data.propertyConfirmation, paymentDueAt: due.toISOString() }, ipHash }, tx);
    return { paymentDueAt: due };
  });
}

const unavailableSchema = z.object({ reason: z.string().trim().min(5, "Say why, and suggest other dates or places if you can").max(1000) });

/** The property cannot take the booking. */
export async function markStayUnavailable(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:bookings.manage");
  const { reason } = unavailableSchema.parse(input);
  const b = await loadForStaff(id);
  if (b.status !== "REQUESTED" && b.status !== "CONFIRMED") throw new AppError("CONFLICT", "Only an unpaid booking can be marked not available. Cancel a paid booking instead.");
  const pending = await db.paymentTransaction.count({ where: { stayBookingId: id, status: { in: ["PENDING", "CREATED"] } } });
  if (pending) throw new AppError("CONFLICT", "The guest has sent a payment that finance has not checked yet. Check it first, then cancel the booking with a full refund.");
  return db.$transaction(async (tx) => {
    const moved = await tx.stayBooking.updateMany({ where: { id, status: b.status }, data: { status: "UNAVAILABLE", cancelReason: reason, cancelledAt: new Date(), cancelledBy: "STAFF" } });
    if (!moved.count) throw new AppError("CONFLICT", "This booking changed. Reload and try again.");
    await notify([{ userId: b.guestId, type: "stay.unavailable", title: `Not available: ${b.property.title}`, body: `Sorry, ${b.property.title} cannot take your booking ${b.reference}: ${reason} You have not been charged.`, link: "/stays", email: true }], tx);
    await audit({ actorId: actor.id, action: "stay.unavailable", targetType: "StayBooking", targetId: id, metadata: { reason }, ipHash }, tx);
  });
}

const staffCancelSchema = z.object({
  reason: z.string().trim().min(5, "Say why the booking is cancelled").max(1000),
  refund: z.enum(["FULL", "POLICY"]).default("FULL"),
});

/**
 * Staff cancel a booking. A paid booking is refunded in full when the property let the guest down,
 * or by the cancellation policy when the guest asked our team to cancel.
 */
export async function cancelStayByStaff(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:bookings.manage");
  const data = staffCancelSchema.parse(input);
  const b = await loadForStaff(id);
  if (!OPEN.includes(b.status)) throw new AppError("CONFLICT", "This booking is already closed");
  const refund = b.status === "PAID" ? (data.refund === "FULL" ? b.totalMinor : guestRefundIfCancelled(b)) : null;
  return db.$transaction(async (tx) => {
    const moved = await tx.stayBooking.updateMany({ where: { id, status: b.status }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "STAFF", cancelReason: data.reason, refundDueMinor: refund } });
    if (!moved.count) throw new AppError("CONFLICT", "This booking changed. Reload and try again.");
    const money = refund === null ? "" : refund > 0n ? ` We will send back ${formatMoney(refund, b.currency)} to the number or account you paid from.` : " No refund is due under the cancellation policy.";
    await notify(
      [
        { userId: b.guestId, type: "stay.cancelled", title: `Booking ${b.reference} cancelled`, body: `We cancelled your stay at ${b.property.title}: ${data.reason}${money}`, link: `/dashboard/stays/${b.reference}`, email: true },
        ...(refund && refund > 0n ? (await financeToTell(tx)).map((userId) => ({ userId, type: "stay.refund_due", title: `Refund due: ${b.reference}`, body: `Send ${formatMoney(refund, b.currency)} back to the guest and record it in Bookings.`, link: "/admin/stays?status=CANCELLED" })) : []),
      ],
      tx,
    );
    await audit({ actorId: actor.id, action: "stay.cancel_staff", targetType: "StayBooking", targetId: id, metadata: { reason: data.reason, refundMinor: refund?.toString() ?? null }, ipHash }, tx);
  });
}

const roomSchema = z.object({ roomNumber: z.string().trim().min(1, "Enter the room number").max(40), note: z.string().trim().max(500).optional().transform((v) => v || undefined) });

/** Record the room the property has given the guest. Most hotels assign it close to arrival. */
export async function setStayRoom(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:bookings.manage");
  const data = roomSchema.parse(input);
  const b = await loadForStaff(id);
  if (b.status !== "CONFIRMED" && b.status !== "PAID") throw new AppError("CONFLICT", "Rooms are recorded for confirmed or paid bookings");
  return db.$transaction(async (tx) => {
    await tx.stayBooking.update({ where: { id }, data: { roomNumber: data.roomNumber, ...(data.note ? { staffNote: data.note } : {}) } });
    if (b.status === "PAID") {
      await notify([{ userId: b.guestId, type: "stay.room", title: `Your room at ${b.property.title}: ${data.roomNumber}`, body: `The property has given you room ${data.roomNumber} for booking ${b.reference}. Your receipt now shows it.${data.note ? ` ${data.note}` : ""}`, link: `/dashboard/stays/${b.reference}/receipt`, email: true }], tx);
    }
    await audit({ actorId: actor.id, action: "stay.room_set", targetType: "StayBooking", targetId: id, metadata: { roomNumber: data.roomNumber }, ipHash }, tx);
  });
}

const outcomeSchema = z.object({ outcome: z.enum(["COMPLETED", "NO_SHOW"]), note: z.string().trim().max(500).optional().transform((v) => v || undefined) });

/** After the check-in date, record whether the guest stayed or did not turn up. */
export async function recordStayOutcome(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:bookings.manage");
  const data = outcomeSchema.parse(input);
  const b = await loadForStaff(id);
  if (b.status !== "PAID") throw new AppError("CONFLICT", "Only a paid booking can be closed this way");
  if (daysBetween(stayToday(), b.checkIn) > 0) throw new AppError("CONFLICT", "Wait until the check-in day");
  await db.stayBooking.update({ where: { id }, data: { status: data.outcome, completedAt: new Date(), ...(data.note ? { internalNote: data.note } : {}) } });
  await audit({ actorId: actor.id, action: data.outcome === "COMPLETED" ? "stay.complete" : "stay.no_show", targetType: "StayBooking", targetId: id, ipHash });
}

const payoutSchema = z.object({
  amount: z.string().trim().min(1, "Enter the amount paid to the property").max(20),
  reference: z.string().trim().min(3, "Enter the transfer or receipt number").max(80),
});

/** Finance record what Sukkot Salone paid the property for a booking, so the commission is clear. */
export async function recordStayPayout(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:payments.manage");
  const data = payoutSchema.parse(input);
  const b = await loadForStaff(id);
  if (!b.paidAt) throw new AppError("CONFLICT", "The guest has not paid for this booking");
  if (b.payoutAt) throw new AppError("CONFLICT", "A payout is already recorded for this booking");
  const amount = parseMajorToMinor(data.amount, b.currency);
  if (amount === null || amount < 0n) throw new AppError("VALIDATION", "Enter the amount as a number", { amount: "Numbers only" });
  if (amount > b.totalMinor - b.refundedMinor) throw new AppError("VALIDATION", "That is more than Sukkot Salone kept from the guest's payment", { amount: "Too much" });
  await db.stayBooking.update({ where: { id }, data: { payoutMinor: amount, payoutReference: data.reference, payoutAt: new Date(), payoutById: actor.id } });
  await audit({ actorId: actor.id, action: "stay.payout", targetType: "StayBooking", targetId: id, metadata: { amountMinor: amount.toString(), reference: data.reference }, ipHash });
}

const refundSchema = z.object({
  amount: z.string().trim().min(1).max(20),
  externalReference: z.string().trim().min(4, "Enter the refund transaction ID").max(60),
});

/** Finance record a refund they sent back to the guest. A full refund marks the payment REFUNDED. */
export async function recordStayRefund(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:payments.manage");
  const data = refundSchema.parse(input);
  const b = await db.stayBooking.findUnique({ where: { id }, include: { property: { select: { title: true } }, payments: true } });
  if (!b) throw notFound("Booking");
  const paid = b.payments.find((p) => (p.status === "SUCCEEDED" && p.providerVerified) || p.status === "RECORDED");
  if (!paid) throw new AppError("CONFLICT", "There is no confirmed payment on this booking to refund");
  const amount = parseMajorToMinor(data.amount, b.currency);
  if (!amount || amount <= 0n) throw new AppError("VALIDATION", "Enter the amount sent back", { amount: "Numbers only" });
  const outstanding = (b.refundDueMinor ?? 0n) - b.refundedMinor;
  if (amount > paid.amountMinor - b.refundedMinor) throw new AppError("VALIDATION", "That is more than the guest paid", { amount: "Too much" });
  if (paid.payerId === actor.id) throw forbidden("You cannot record a refund to yourself");
  const refundedMinor = b.refundedMinor + amount;
  const full = refundedMinor >= paid.amountMinor;
  return db.$transaction(async (tx) => {
    await tx.refund.create({ data: { transactionId: paid.id, amountMinor: amount, currency: b.currency, reason: `Booking ${b.reference}${b.cancelReason ? `: ${b.cancelReason}` : ""}`, status: "RECORDED" } });
    await tx.paymentEvent.create({ data: { transactionId: paid.id, type: "refund_recorded", source: "finance", statusBefore: paid.status, statusAfter: full ? "REFUNDED" : paid.status, payload: { by: actor.id, amountMinor: amount.toString(), externalReference: data.externalReference } } });
    if (full) await tx.paymentTransaction.update({ where: { id: paid.id }, data: { status: "REFUNDED" } });
    await tx.stayBooking.update({ where: { id }, data: { refundedMinor } });
    await notify([{ userId: b.guestId, type: "payment.refunded", title: "Refund sent", body: `We sent back ${formatMoney(amount, b.currency)} for booking ${b.reference} at ${b.property.title} (refund transaction ${data.externalReference}).`, link: `/dashboard/stays/${b.reference}`, email: true }], tx);
    await audit({ actorId: actor.id, action: "stay.refund_record", targetType: "StayBooking", targetId: id, metadata: { amountMinor: amount.toString(), externalReference: data.externalReference, outstandingBefore: outstanding.toString() }, ipHash }, tx);
  });
}

/* ------------------------------------------------------------------ Payments hooks */

/** Price a booking for checkout. Only the guest, only once confirmed, and only before the deadline. */
export async function priceStayBooking(userId: string, stayBookingId: string | undefined) {
  const b = stayBookingId ? await db.stayBooking.findUnique({ where: { id: stayBookingId }, include: { property: { select: { title: true } } } }) : null;
  if (!b || b.guestId !== userId) throw notFound("Booking");
  if (b.status === "PAID") throw new AppError("CONFLICT", "This booking is already paid");
  if (b.status === "REQUESTED") throw new AppError("CONFLICT", "Wait until the property confirms the room before paying");
  if (b.status !== "CONFIRMED") throw new AppError("CONFLICT", "This booking is closed and cannot be paid");
  if (b.paymentDueAt && b.paymentDueAt.getTime() < Date.now()) {
    await expireStayBookings();
    throw new AppError("CONFLICT", "The time to pay for this booking has passed. Ask for the dates again.");
  }
  const pending = await db.paymentTransaction.findMany({ where: { stayBookingId: b.id, status: "PENDING" }, select: { providerData: true } });
  if (pending.some((p) => (p.providerData as { manualChannel?: string } | null)?.manualChannel)) {
    throw new AppError("CONFLICT", "You have already sent a payment for this booking. Wait for our finance team to check it.");
  }
  return { amountMinor: b.totalMinor, currency: b.currency, description: `Booking ${b.reference} at ${b.property.title}`, propertyId: b.propertyId, stayBookingId: b.id };
}

/** Called when a booking's payment is confirmed by the provider or by finance. */
export async function settleStayBooking(tx: Tx, p: { id: string; stayBookingId: string | null; amountMinor: bigint; currency: Currency; reference: string; paidAt: Date | null }) {
  if (!p.stayBookingId) return;
  const b = await tx.stayBooking.findUnique({ where: { id: p.stayBookingId }, include: { property: { select: { title: true } } } });
  if (!b) return;
  const paidAt = p.paidAt ?? new Date();
  if (b.status === "CONFIRMED" || b.status === "EXPIRED") {
    await tx.stayBooking.update({ where: { id: b.id }, data: { status: "PAID", paidAt } });
    await notify(
      [
        { userId: b.guestId, type: "stay.paid", title: `You're booked: ${b.property.title}`, body: `We received ${formatMoney(p.amountMinor, p.currency)} for booking ${b.reference}. Your receipt has the address, your room and your dates. Show it at check-in.`, link: `/dashboard/stays/${b.reference}/receipt`, email: true },
        ...(await staffToTell(tx)).map((userId) => ({ userId, type: "stay.paid", title: `Paid: ${b.reference}`, body: `${b.guestName} paid for ${b.property.title}.${b.status === "EXPIRED" ? " The payment came after the deadline: check the room is still held." : ""} Confirm with the property and record the room number.`, link: "/admin/stays?status=PAID" })),
      ],
      tx,
    );
  } else {
    // The booking was closed before the money arrived: it all goes back to the guest.
    await tx.stayBooking.update({ where: { id: b.id }, data: { paidAt, refundDueMinor: p.amountMinor } });
    await notify((await financeToTell(tx)).map((userId) => ({ userId, type: "stay.refund_due", title: `Refund due: ${b.reference}`, body: `A payment of ${formatMoney(p.amountMinor, p.currency)} (${p.reference}) arrived for a booking that is ${STAY_BOOKING_STATUS_LABELS[b.status].toLowerCase()}. Send it back and record it in Bookings.`, link: "/admin/stays?status=CANCELLED" })), tx);
  }
}

/** The listing fee for a stay: listing, photos and video. */
export async function priceStayListing(userId: string, propertyId: string | undefined) {
  const p = propertyId ? await db.property.findUnique({ where: { id: propertyId }, select: { id: true, reference: true, listerId: true, ownerId: true, stayKind: true, stayListingPaidAt: true, stayArrangedAt: true } }) : null;
  if (!p || (p.listerId !== userId && p.ownerId !== userId)) throw notFound("Listing");
  if (!p.stayKind) throw new AppError("CONFLICT", "Say what kind of place it is before paying the listing fee");
  if (p.stayListingPaidAt || p.stayArrangedAt) throw new AppError("CONFLICT", "This listing is already set up for bookings");
  const fee = await getSetting("stay.listingFee");
  if (!fee) throw new AppError("BAD_REQUEST", "There is no listing fee to pay");
  return { amountMinor: BigInt(fee.priceMinor), currency: fee.currency, description: `${STAY_KIND_LABELS[p.stayKind]} listing with photos and video for ${p.reference}`, propertyId: p.id };
}

/** The listing fee is paid: bookings can open, and our team books the photo shoot it includes. */
export async function settleStayListing(tx: Tx, p: { id: string; propertyId: string | null; payerId: string | null; payerPhone: string | null; amountMinor: bigint; currency: Currency; reference: string }) {
  if (!p.propertyId || !p.payerId) return;
  await tx.property.update({ where: { id: p.propertyId }, data: { stayListingPaidAt: new Date() } });
  const open = await tx.siteVisit.findFirst({ where: { propertyId: p.propertyId, kind: "PHOTO_SHOOT", status: { in: ["REQUESTED", "SCHEDULED"] } } });
  if (!open) await tx.siteVisit.create({ data: { kind: "PHOTO_SHOOT", propertyId: p.propertyId, requesterId: p.payerId, paymentId: p.id, contactPhone: p.payerPhone, requestNote: "Included in the listing fee for bookable stays." } });
  else if (!open.paymentId) await tx.siteVisit.update({ where: { id: open.id }, data: { paymentId: p.id } });
  await notify(
    (await staffToTell(tx)).map((userId) => ({ userId, type: "visit.photo_paid", title: "Stay listing fee paid", body: `The ${formatMoney(p.amountMinor, p.currency)} listing fee (${p.reference}) is confirmed. It includes photos and video: agree a date for the shoot.`, link: "/admin/visits" })),
    tx,
  );
}

/* ------------------------------------------------------------------------- Receipt */

/** Everything a paid guest's receipt shows. */
export async function getStayReceipt(actorIn: Actor | null, reference: string) {
  const b = await getStayBooking(actorIn, reference);
  if (!PAID_STATES.includes(b.status) && !(b.status === "CANCELLED" && b.paidAt)) throw new AppError("CONFLICT", "The receipt is ready once your payment is confirmed");
  const payment = confirmedPayment(b);
  if (!payment) throw new AppError("CONFLICT", "The receipt is ready once your payment is confirmed");
  const details = readStayDetails(b.property.stayDetails);
  return { booking: b, payment, details, address: [b.property.addressLine, locationParts(b.property.location).label].filter(Boolean).join(", ") };
}

/** Money summary for staff: what came in, went back and went to the property. */
export function bookingMoney(b: Pick<StayBooking, "totalMinor" | "refundedMinor" | "refundDueMinor" | "payoutMinor" | "currency" | "paidAt">, commissionBps: number | null) {
  const kept = b.paidAt ? b.totalMinor - b.refundedMinor : 0n;
  const suggestedPayout = commissionBps !== null && b.paidAt ? kept - (kept * BigInt(commissionBps) + 5000n) / 10000n : null;
  return {
    received: b.paidAt ? formatMoney(b.totalMinor, b.currency) : null,
    refundOutstanding: b.refundDueMinor !== null && b.refundDueMinor > b.refundedMinor ? formatMoney(b.refundDueMinor - b.refundedMinor, b.currency) : null,
    refundOutstandingMajor: b.refundDueMinor !== null && b.refundDueMinor > b.refundedMinor ? minorToMajorString(b.refundDueMinor - b.refundedMinor, b.currency) : null,
    refunded: b.refundedMinor > 0n ? formatMoney(b.refundedMinor, b.currency) : null,
    payout: b.payoutMinor !== null ? formatMoney(b.payoutMinor, b.currency) : null,
    suggestedPayoutMajor: suggestedPayout !== null ? minorToMajorString(suggestedPayout, b.currency) : null,
    commission: b.payoutMinor !== null ? formatMoney(kept - b.payoutMinor, b.currency) : null,
  };
}
