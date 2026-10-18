import "server-only";
import { z } from "zod";
import { formatDateTime, INSPECTED_BADGE } from "@sukkot/shared";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor, assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";

/**
 * Paid inspection visits: a lister pays (see payments `INSPECTION_VISIT`), which opens a visit as
 * REQUESTED. Staff agree a date (SCHEDULED), go, take the photos and video, and mark it COMPLETED,
 * which gives the listing a dated "Inspected by Sukkot" badge. A visit staff cannot make is CANCELLED
 * and the payment refunded through Payments, as the refund policy says.
 */

const visitInclude = {
  property: { select: { id: true, title: true, reference: true, slug: true, listingStatus: true, location: { select: { name: true } } } },
  requester: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true } } } },
  payment: { select: { reference: true, amountMinor: true, currency: true, status: true } },
  staff: { select: { profile: { select: { fullName: true } } } },
} satisfies Prisma.SiteVisitInclude;

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

export async function cancelVisit(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:listings.moderate");
  const data = cancelSchema.parse(input);
  const v = await load(id);
  if (v.status !== "REQUESTED" && v.status !== "SCHEDULED") throw new AppError("CONFLICT", "This visit is already closed");
  return db.$transaction(async (tx) => {
    const updated = await tx.siteVisit.update({ where: { id }, data: { status: "CANCELLED", cancelReason: data.reason, staffId: actor.id } });
    await notify(
      [{ userId: v.requesterId, type: "visit.cancelled", title: "Inspection visit cancelled", body: `We cancelled the inspection visit for ${v.property.title}: ${data.reason} Your payment will be refunded in full, as our refund policy says.`, link: "/refunds", email: true }],
      tx,
    );
    await audit({ actorId: actor.id, action: "visit.cancel", targetType: "SiteVisit", targetId: id, metadata: { reason: data.reason }, ipHash }, tx);
    return updated;
  });
}
