import "server-only";
import {
  formatDateTime,
  inspectionActionSchema,
  inspectionMachine,
  inspectionRequestSchema,
  intervalsOverlap,
  type InspectionDTO,
  type InspectionSide,
} from "@sukkot/shared";
import type { Inspection } from "@prisma/client";
import { db, type Tx } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor } from "../auth/actor";
import { notify } from "../notify";
import { postSystemMessage } from "./messaging";

const MIN_LEAD_MS = 60 * 60 * 1000;
const MAX_AHEAD_MS = 90 * 86400_000;
const ACTIVE = ["CONFIRMED"] as const;

/** Serialise confirmations per representative so two overlapping slots can never both be confirmed. */
async function lockRepresentative(tx: Tx, representativeId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"inspection:" + representativeId}))`;
}

async function assertNoConflict(tx: Tx, insp: Pick<Inspection, "id" | "representativeId" | "durationMinutes">, at: Date) {
  const windowStart = new Date(at.getTime() - 4 * 3600_000);
  const windowEnd = new Date(at.getTime() + 4 * 3600_000);
  const others = await tx.inspection.findMany({
    where: { representativeId: insp.representativeId, id: { not: insp.id }, status: { in: [...ACTIVE] }, scheduledAt: { gte: windowStart, lte: windowEnd } },
    select: { scheduledAt: true, durationMinutes: true },
  });
  if (others.some((o) => intervalsOverlap(at, insp.durationMinutes, o.scheduledAt, o.durationMinutes))) {
    throw new AppError("CONFLICT", "That time overlaps another confirmed inspection. Propose a different time.");
  }
}

function assertSchedulable(at: Date) {
  const now = Date.now();
  if (at.getTime() < now + MIN_LEAD_MS) throw new AppError("VALIDATION", "Choose a time at least one hour from now", { scheduledAt: "Too soon" });
  if (at.getTime() > now + MAX_AHEAD_MS) throw new AppError("VALIDATION", "Choose a time within the next 90 days", { scheduledAt: "Too far ahead" });
}

async function propertyConversation(tx: Tx, propertyId: string, a: string, b: string, subject: string) {
  const existing = await tx.conversation.findFirst({
    where: { propertyId, applicationId: null, offerId: null, AND: [{ participants: { some: { userId: a } } }, { participants: { some: { userId: b } } }] },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existing) return existing;
  return tx.conversation.create({ data: { subject, propertyId, participants: { create: [{ userId: a }, { userId: b }] } } });
}

export async function requestInspection(actorIn: Actor | null, input: unknown) {
  const actor = assertActor(actorIn);
  const data = inspectionRequestSchema.parse(input);
  assertSchedulable(data.scheduledAt);
  const property = await db.property.findUnique({ where: { id: data.propertyId }, select: { id: true, title: true, reference: true, listerId: true, ownerId: true, listingStatus: true } });
  if (!property || property.listingStatus !== "PUBLISHED") throw notFound("Listing");
  if (property.listerId === actor.id || property.ownerId === actor.id) throw new AppError("BAD_REQUEST", "You cannot book an inspection of your own listing");
  return db.$transaction(async (tx) => {
    const pending = await tx.inspection.count({
      where: { propertyId: property.id, requesterId: actor.id, status: { in: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"] } },
    });
    if (pending > 0) throw new AppError("CONFLICT", "You already have an upcoming inspection request for this property");
    const insp = await tx.inspection.create({
      data: {
        propertyId: property.id,
        requesterId: actor.id,
        representativeId: property.listerId,
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        attendees: data.attendees,
        contactPhone: data.contactPhone ?? null,
        notes: data.notes ?? null,
      },
    });
    const convo = await propertyConversation(tx, property.id, actor.id, property.listerId, `${property.title} (${property.reference})`);
    await postSystemMessage(tx, convo.id, actor.id, `Inspection requested for ${formatDateTime(data.scheduledAt)} (Freetown time).`);
    await notify(
      [{ userId: property.listerId, type: "inspection.requested", title: `Inspection request for ${property.reference}`, body: `${actor.name} would like to view on ${formatDateTime(data.scheduledAt)}.`, link: "/dashboard/inspections", email: true }],
      tx,
    );
    return insp;
  });
}

function sideOf(actor: Actor, insp: Pick<Inspection, "requesterId" | "representativeId">): InspectionSide | null {
  if (insp.representativeId === actor.id) return "REPRESENTATIVE";
  if (insp.requesterId === actor.id) return "REQUESTER";
  return null;
}

export async function actOnInspection(actorIn: Actor | null, id: string, input: unknown) {
  const actor = assertActor(actorIn);
  const data = inspectionActionSchema.parse(input);
  return db.$transaction(async (tx) => {
    const insp = await tx.inspection.findUnique({ where: { id }, include: { property: { select: { title: true, reference: true } } } });
    if (!insp) throw notFound("Inspection");
    const side = sideOf(actor, insp);
    if (!side) throw notFound("Inspection");
    const next = inspectionMachine.next(insp.status, data.action, side);
    const update: Parameters<typeof tx.inspection.update>[0]["data"] = { status: next, responseNote: data.note ?? insp.responseNote };

    if (data.action === "propose_reschedule") {
      if (!data.proposedAt) throw new AppError("VALIDATION", "Choose the new time", { proposedAt: "Required" });
      assertSchedulable(data.proposedAt);
      update.proposedAt = data.proposedAt;
      update.proposedById = actor.id;
    }
    if (data.action === "accept_reschedule") {
      if (insp.proposedById === actor.id) throw new AppError("FORBIDDEN", "The other party needs to accept the time you proposed");
      if (!insp.proposedAt) throw new AppError("CONFLICT", "There is no proposed time to accept");
      await lockRepresentative(tx, insp.representativeId);
      await assertNoConflict(tx, insp, insp.proposedAt);
      update.scheduledAt = insp.proposedAt;
      update.proposedAt = null;
      update.proposedById = null;
    }
    if (data.action === "confirm") {
      if (insp.scheduledAt.getTime() < Date.now()) throw new AppError("CONFLICT", "This time has passed. Propose a new time instead.");
      await lockRepresentative(tx, insp.representativeId);
      await assertNoConflict(tx, insp, insp.scheduledAt);
    }
    const updated = await tx.inspection.update({ where: { id }, data: update });
    const otherId = side === "REPRESENTATIVE" ? insp.requesterId : insp.representativeId;
    const when = formatDateTime(updated.proposedAt ?? updated.scheduledAt);
    const text: Record<string, string> = {
      confirm: `Inspection confirmed for ${when}.`,
      propose_reschedule: `A new time was proposed: ${when}.`,
      accept_reschedule: `New inspection time confirmed: ${when}.`,
      decline: "The inspection request was declined.",
      cancel: "The inspection was cancelled.",
      complete: "The inspection was marked as completed.",
      mark_no_show: "The inspection was marked as a no-show.",
    };
    await notify(
      [{ userId: otherId, type: `inspection.${data.action}`, title: `Inspection update: ${insp.property.reference}`, body: `${text[data.action]}${data.note ? ` Note: ${data.note}` : ""}`, link: "/dashboard/inspections", email: data.action !== "complete" }],
      tx,
    );
    const convo = await propertyConversation(tx, insp.propertyId, insp.requesterId, insp.representativeId, `${insp.property.title} (${insp.property.reference})`);
    await postSystemMessage(tx, convo.id, actor.id, text[data.action]!);
    return updated;
  });
}

export async function listInspections(actorIn: Actor | null): Promise<InspectionDTO[]> {
  const actor = assertActor(actorIn);
  const rows = await db.inspection.findMany({
    where: { OR: [{ requesterId: actor.id }, { representativeId: actor.id }] },
    include: {
      property: { select: { id: true, title: true, slug: true } },
      requester: { select: { id: true, profile: { select: { fullName: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });
  return rows.map((r) => {
    const side = sideOf(actor, r)!;
    let actions = inspectionMachine.available(r.status, side) as string[];
    if (r.proposedById === actor.id) actions = actions.filter((a) => a !== "accept_reschedule");
    return {
      id: r.id,
      status: r.status,
      scheduledAt: r.scheduledAt.toISOString(),
      proposedAt: r.proposedAt?.toISOString() ?? null,
      proposedById: r.proposedById,
      durationMinutes: r.durationMinutes,
      notes: r.notes,
      property: r.property,
      requester: { id: r.requester.id, name: r.requester.profile?.fullName ?? "User" },
      myRole: side,
      actions,
    };
  });
}
