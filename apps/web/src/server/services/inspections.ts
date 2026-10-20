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
import type { Inspection, PaymentTransaction } from "@prisma/client";
import { db, type Tx } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor } from "../auth/actor";
import { notify } from "../notify";
import { postSystemMessage } from "./messaging";
import { getSetting } from "./settings";

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

async function staffToTell(tx: Tx) {
  const staff = await tx.userRoleAssignment.findMany({ where: { role: { in: ["MODERATOR", "SUPER_ADMIN"] }, user: { status: "ACTIVE" } }, select: { userId: true }, distinct: ["userId"] });
  return staff.map((s) => s.userId);
}

/** Pass a request on to the landlord or agent, in the conversation about the listing and by notification. */
async function sendToRepresentative(tx: Tx, insp: Pick<Inspection, "propertyId" | "requesterId" | "representativeId" | "scheduledAt">, property: { title: string; reference: string }, requesterName: string) {
  const convo = await propertyConversation(tx, insp.propertyId, insp.requesterId, insp.representativeId, `${property.title} (${property.reference})`);
  await postSystemMessage(tx, convo.id, insp.requesterId, `Inspection requested for ${formatDateTime(insp.scheduledAt)} (Freetown time).`);
  await notify(
    [{ userId: insp.representativeId, type: "inspection.requested", title: `Inspection request for ${property.reference}`, body: `${requesterName} would like to view on ${formatDateTime(insp.scheduledAt)}.`, link: "/dashboard/inspections", email: true }],
    tx,
  );
}

/**
 * Booking an inspection costs the tenant or buyer a small fee to Sukkot Salone when one is set in Site
 * settings (`fees.viewing`). The request is saved straight away, but the landlord or agent only sees
 * it once the fee is confirmed by the payment provider or by finance (see `markViewingFeePaid`).
 */
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
    const fee = await getSetting("fees.viewing");
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
        feeMinor: fee ? BigInt(fee.priceMinor) : null,
        feeCurrency: fee?.currency ?? null,
      },
    });
    if (!fee) await sendToRepresentative(tx, insp, property, actor.name);
    return insp;
  });
}

/**
 * The booking fee is confirmed: send the request on to the landlord or agent and tell our team.
 * A second payment for the same inspection changes nothing; finance refunds it.
 */
export async function markViewingFeePaid(tx: Tx, p: Pick<PaymentTransaction, "inspectionId" | "paidAt" | "amountMinor" | "currency" | "reference">) {
  if (!p.inspectionId) return;
  const moved = await tx.inspection.updateMany({ where: { id: p.inspectionId, feePaidAt: null }, data: { feePaidAt: p.paidAt ?? new Date() } });
  if (!moved.count) return;
  const insp = await tx.inspection.findUniqueOrThrow({
    where: { id: p.inspectionId },
    include: { property: { select: { title: true, reference: true } }, requester: { select: { email: true, phone: true, profile: { select: { fullName: true } } } } },
  });
  const name = insp.requester.profile?.fullName ?? insp.requester.email;
  if (["REQUESTED", "RESCHEDULE_PROPOSED", "CONFIRMED"].includes(insp.status)) await sendToRepresentative(tx, insp, insp.property, name);
  await notify(
    (await staffToTell(tx)).map((userId) => ({
      userId,
      type: "inspection.fee_paid",
      title: `Inspection booked: ${insp.property.reference}`,
      body: `${name} paid the inspection booking fee (${p.reference}) to view "${insp.property.title}" on ${formatDateTime(insp.scheduledAt)}. Phone: ${insp.contactPhone ?? insp.requester.phone ?? "not given"}.`,
      link: "/admin/payments",
    })),
    tx,
  );
}

/** Fee-bearing requests stay with the requester until the fee is paid. */
const visibleToRepresentative = { OR: [{ feeMinor: null }, { feePaidAt: { not: null } }] };

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
    if (!side || (side === "REPRESENTATIVE" && insp.feeMinor !== null && !insp.feePaidAt)) throw notFound("Inspection");
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
    where: { OR: [{ requesterId: actor.id }, { representativeId: actor.id, ...visibleToRepresentative }] },
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
      fee: r.feeMinor !== null && r.feeCurrency ? { amountMinor: r.feeMinor.toString(), currency: r.feeCurrency, paid: !!r.feePaidAt } : null,
      myRole: side,
      actions,
    };
  });
}
