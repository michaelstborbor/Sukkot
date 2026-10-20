import "server-only";
import { z } from "zod";
import { formatDateTime, formatMoney, formatSlPhone, INSPECTED_BADGE, phoneSchema } from "@sukkot/shared";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor, assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";
import { getSetting } from "./settings";

/**
 * Paid inspection visits: a lister pays (see payments `INSPECTION_VISIT`), which opens a visit as
 * REQUESTED. Staff agree a date (SCHEDULED), go, take the photos and video, and mark it COMPLETED,
 * which gives the listing a dated "Inspected by Sukkot" badge. A visit staff cannot make is CANCELLED
 * and the payment refunded through Payments, as the refund policy says.
 *
 * Photo shoots (`kind: PHOTO_SHOOT`) are booked from the listing form instead of uploading photos:
 * the request opens straight away and staff are told, and the lister then pays (`PHOTO_SHOOT`). Staff
 * upload the photos and video to the listing and mark the shoot done; no badge is given.
 */

const visitInclude = {
  property: { select: { id: true, title: true, reference: true, slug: true, listingStatus: true, location: { select: { name: true } } } },
  requester: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true } } } },
  payment: { select: { reference: true, amountMinor: true, currency: true, status: true } },
  staff: { select: { profile: { select: { fullName: true } } } },
} satisfies Prisma.SiteVisitInclude;

/** Listing states in which a lister can ask for a visit of either kind. */
export const VISIT_LISTING_STATUSES: string[] = ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED"];

async function staffToTell(tx: Prisma.TransactionClient | typeof db = db) {
  const staff = await tx.userRoleAssignment.findMany({ where: { role: { in: ["MODERATOR", "SUPER_ADMIN"] }, user: { status: "ACTIVE" } }, select: { userId: true }, distinct: ["userId"] });
  return staff.map((s) => s.userId);
}

const photoShootSchema = z.object({
  contactPhone: phoneSchema,
  note: z.string().trim().max(1000).optional().transform((v) => v || undefined),
});

/** The open photo shoot for a listing, if there is one. */
export function openPhotoShoot(propertyId: string) {
  return db.siteVisit.findFirst({ where: { propertyId, kind: "PHOTO_SHOOT", status: { in: ["REQUESTED", "SCHEDULED"] } }, include: { payment: { select: { status: true } } } });
}

/**
 * A lister asks Sukkot Salone to take the photos and video for a listing. The request is open at
 * once and staff are told by notification and email; the lister pays for it separately.
 */
export async function requestPhotoShoot(actorIn: Actor | null, propertyId: string, input: unknown, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const data = photoShootSchema.parse(input);
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, title: true, reference: true, listerId: true, ownerId: true, listingStatus: true, privateContactEmail: true, location: { select: { name: true } }, propertyType: { select: { name: true } } },
  });
  if (!property || (property.listerId !== actor.id && property.ownerId !== actor.id)) throw notFound("Listing");
  if (!VISIT_LISTING_STATUSES.includes(property.listingStatus)) throw new AppError("CONFLICT", "Photos cannot be arranged for a listing that is closed, rejected or removed");
  const price = await getSetting("visit.photoShoot");
  if (!price) throw new AppError("NOT_CONFIGURED", "Professional photos are not available yet");
  if (await openPhotoShoot(property.id)) throw new AppError("CONFLICT", "You have already asked us to take photos of this listing");
  const fee = formatMoney(BigInt(price.priceMinor), price.currency);

  return db.$transaction(async (tx) => {
    const visit = await tx.siteVisit.create({ data: { kind: "PHOTO_SHOOT", propertyId: property.id, requesterId: actor.id, contactPhone: data.contactPhone, requestNote: data.note ?? null } });
    // Keep the listing's private contact number in step with the one given for the shoot.
    await tx.property.update({ where: { id: property.id }, data: { privateContactPhone: data.contactPhone } });
    const lines = [
      `${actor.name || actor.email} asked us to take professional photos and video of ${property.propertyType.name.toLowerCase()} ${property.reference}, "${property.title}", in ${property.location.name}.`,
      `Phone: ${formatSlPhone(data.contactPhone)}. Email: ${property.privateContactEmail ?? actor.email}.`,
      data.note ? `Their note: ${data.note}` : null,
      `Fee: ${fee}, not paid yet. Agree a date with them in Visits.`,
    ].filter(Boolean);
    await notify(
      [
        ...(await staffToTell(tx)).map((userId) => ({ userId, type: "visit.photo_requested", title: `Photo shoot requested: ${property.reference}`, body: lines.join(" "), link: "/admin/visits", email: true })),
        { userId: actor.id, type: "visit.photo_requested", title: "Photo shoot request sent", body: `We have your request for professional photos and video of ${property.title}. Pay the ${fee} fee from the listing page and we will call you on ${formatSlPhone(data.contactPhone)} to agree a date.`, link: `/dashboard/properties/${property.id}/finish` },
      ],
      tx,
    );
    await audit({ actorId: actor.id, action: "visit.photo_request", targetType: "SiteVisit", targetId: visit.id, metadata: { propertyId: property.id }, ipHash }, tx);
    return visit;
  });
}

export async function listVisits(actorIn: Actor | null, status?: string) {
  assertPermission(actorIn, "admin:listings.moderate");
  const open = ["REQUESTED", "SCHEDULED"] as const;
  const where: Prisma.SiteVisitWhereInput = status === "ALL" ? {} : status === "COMPLETED" || status === "CANCELLED" ? { status } : { status: { in: [...open] } };
  return db.siteVisit.findMany({ where, include: visitInclude, orderBy: [{ scheduledAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }], take: 200 });
}

/** The visits for one of your own listings, newest first. */
export async function visitsForListing(actorIn: Actor | null, propertyId: string) {
  const actor = assertActor(actorIn);
  return db.siteVisit.findMany({
    where: { propertyId, property: { OR: [{ listerId: actor.id }, { ownerId: actor.id }] } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

const scheduleSchema = z.object({ scheduledAt: z.coerce.date(), note: z.string().trim().max(500).optional().transform((v) => v || undefined) });
const completeSchema = z.object({ note: z.string().trim().min(5, "Say briefly what you checked").max(2000) });
const cancelSchema = z.object({ reason: z.string().trim().min(5, "Say why the visit is cancelled").max(500) });

async function load(id: string) {
  const v = await db.siteVisit.findUnique({ where: { id }, include: { property: { select: { id: true, reference: true, title: true } } } });
  if (!v) throw notFound("Visit");
  return v;
}

export async function scheduleVisit(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:listings.moderate");
  const data = scheduleSchema.parse(input);
  const v = await load(id);
  if (v.status !== "REQUESTED" && v.status !== "SCHEDULED") throw new AppError("CONFLICT", "This visit is already closed");
  if (data.scheduledAt.getTime() < Date.now() - 3600_000) throw new AppError("VALIDATION", "Choose a date that has not passed", { scheduledAt: "In the past" });
  return db.$transaction(async (tx) => {
    const updated = await tx.siteVisit.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt: data.scheduledAt, staffId: actor.id, staffNote: data.note ?? v.staffNote } });
    await notify(
      [{ userId: v.requesterId, type: "visit.scheduled", title: "Inspection visit booked", body: `Our staff will visit ${v.property.title} (${v.property.reference}) on ${formatDateTime(data.scheduledAt)}.${data.note ? ` ${data.note}` : ""}`, link: `/dashboard/properties/${v.propertyId}`, email: true }],
      tx,
    );
    await audit({ actorId: actor.id, action: "visit.schedule", targetType: "SiteVisit", targetId: id, metadata: { scheduledAt: data.scheduledAt.toISOString() }, ipHash }, tx);
    return updated;
  });
}

export async function completeVisit(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:listings.moderate");
  const data = completeSchema.parse(input);
  const v = await load(id);
  if (v.status !== "SCHEDULED") throw new AppError("CONFLICT", "Book a date for the visit before marking it done");
  if (v.kind === "PHOTO_SHOOT") return completePhotoShoot(actor, v, data.note, ipHash);
  const now = new Date();
  return db.$transaction(async (tx) => {
    const updated = await tx.siteVisit.update({ where: { id, status: "SCHEDULED" }, data: { status: "COMPLETED", completedAt: now, staffId: actor.id, staffNote: data.note } });
    await tx.property.update({ where: { id: v.propertyId }, data: { inspectedAt: now } });
    await notify(
      [{ userId: v.requesterId, type: "visit.completed", title: `${INSPECTED_BADGE.label}: ${v.property.reference}`, body: `Our staff inspected ${v.property.title}. The listing now shows the dated "${INSPECTED_BADGE.label}" badge. Notes: ${data.note}`, link: `/dashboard/properties/${v.propertyId}`, email: true }],
      tx,
    );
    await audit({ actorId: actor.id, action: "visit.complete", targetType: "SiteVisit", targetId: id, metadata: { propertyId: v.propertyId }, ipHash }, tx);
    return updated;
  });
}

async function completePhotoShoot(actor: Actor, v: Awaited<ReturnType<typeof load>>, note: string, ipHash?: string | null) {
  if ((await db.propertyImage.count({ where: { propertyId: v.propertyId } })) === 0) throw new AppError("CONFLICT", "Upload the photos to the listing before marking the shoot done");
  return db.$transaction(async (tx) => {
    const updated = await tx.siteVisit.update({ where: { id: v.id, status: "SCHEDULED" }, data: { status: "COMPLETED", completedAt: new Date(), staffId: actor.id, staffNote: note } });
    await notify(
      [{ userId: v.requesterId, type: "visit.completed", title: `Your photos are ready: ${v.property.reference}`, body: `We added the photos and video to ${v.property.title}. Check them, then submit the listing for review. Notes: ${note}`, link: `/dashboard/properties/${v.propertyId}/finish?step=review`, email: true }],
      tx,
    );
    await audit({ actorId: actor.id, action: "visit.complete", targetType: "SiteVisit", targetId: v.id, metadata: { propertyId: v.propertyId, kind: v.kind }, ipHash }, tx);
    return updated;
  });
}

export async function cancelVisit(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:listings.moderate");
  const data = cancelSchema.parse(input);
  const v = await load(id);
  if (v.status !== "REQUESTED" && v.status !== "SCHEDULED") throw new AppError("CONFLICT", "This visit is already closed");
  return db.$transaction(async (tx) => {
    const updated = await tx.siteVisit.update({ where: { id }, data: { status: "CANCELLED", cancelReason: data.reason, staffId: actor.id } });
    const what = v.kind === "PHOTO_SHOOT" ? "photo shoot" : "inspection visit";
    // We only promise a refund when there is a payment to refund.
    const refund = v.paymentId ? " Your payment will be refunded in full, as our refund policy says." : "";
    await notify(
      [{ userId: v.requesterId, type: "visit.cancelled", title: `${what[0]!.toUpperCase()}${what.slice(1)} cancelled`, body: `We cancelled the ${what} for ${v.property.title}: ${data.reason}${refund}`, link: v.paymentId ? "/refunds" : `/dashboard/properties/${v.propertyId}`, email: true }],
      tx,
    );
    await audit({ actorId: actor.id, action: "visit.cancel", targetType: "SiteVisit", targetId: id, metadata: { reason: data.reason }, ipHash }, tx);
    return updated;
  });
}
