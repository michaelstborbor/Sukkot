import "server-only";
import {
  DUE_DILIGENCE_TEMPLATE,
  OFFER_ACTION_EVENT,
  OFFER_STATUS_LABELS,
  dueDiligenceUpdateSchema,
  formatMoney,
  offerActionSchema,
  offerMachine,
  offerSchema,
  parseMajorToMinor,
  type OfferDTO,
  type OfferSide,
} from "@sukkot/shared";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor } from "../auth/actor";
import { notify } from "../notify";
import { audit } from "../audit";
import { ensureConversation, postSystemMessage } from "./messaging";
import { requireVerifiedContact } from "./auth";

const LIVE = ["SUBMITTED", "UNDER_REVIEW", "COUNTEROFFER_RECEIVED", "ACCEPTED_IN_PRINCIPLE", "PENDING_DUE_DILIGENCE", "TRANSACTION_IN_PROGRESS"] as const;

async function createChecklist(tx: Tx, offerId: string) {
  const existing = await tx.dueDiligenceItem.count({ where: { offerId } });
  if (existing) return;
  await tx.dueDiligenceItem.createMany({
    data: DUE_DILIGENCE_TEMPLATE.map((t, i) => ({ offerId, key: t.key, title: t.title, guidance: t.guidance, sortOrder: i })),
  });
}

export async function createOffer(actorIn: Actor | null, input: unknown) {
  const actor = assertActor(actorIn);
  const data = offerSchema.parse(input);
  await requireVerifiedContact(actor.id, "make an offer");
  const property = await db.property.findUnique({
    where: { id: data.propertyId },
    select: { id: true, title: true, reference: true, listerId: true, ownerId: true, listingStatus: true, purpose: true, currency: true, availability: true, category: true },
  });
  if (!property || property.listingStatus !== "PUBLISHED") throw notFound("Listing");
  if (property.purpose !== "SALE" && property.purpose !== "LEASE") throw new AppError("BAD_REQUEST", "Offers are for properties for sale or lease. Apply to rent instead.");
  if (property.listerId === actor.id || property.ownerId === actor.id) throw new AppError("BAD_REQUEST", "You cannot make an offer on your own listing");
  if (property.availability === "SOLD" || property.availability === "UNAVAILABLE") throw new AppError("CONFLICT", "This property is no longer available");
  if (data.currency !== property.currency) {
    throw new AppError("VALIDATION", `This listing is priced in ${property.currency}. Make your offer in the same currency.`, { currency: "Currency mismatch" });
  }
  if (data.expiresAt && data.expiresAt.getTime() < Date.now() + 3600_000) throw new AppError("VALIDATION", "Offer expiry must be in the future", { expiresAt: "In the past" });
  const amountMinor = parseMajorToMinor(data.amount, data.currency)!;

  return db.$transaction(async (tx) => {
    const live = await tx.offer.findFirst({ where: { propertyId: property.id, buyerId: actor.id, status: { in: [...LIVE] } }, select: { id: true } });
    if (live) throw new AppError("CONFLICT", "You already have an active offer on this property. Continue the negotiation there.");
    const offer = await tx.offer.create({
      data: {
        propertyId: property.id,
        buyerId: actor.id,
        status: "SUBMITTED",
        currentAmountMinor: amountMinor,
        currency: data.currency,
        paymentArrangement: data.paymentArrangement,
        inspectionDone: data.inspectionDone,
        expiresAt: data.expiresAt ?? null,
        events: {
          create: {
            type: "SUBMITTED",
            actorId: actor.id,
            actorSide: "BUYER",
            amountMinor,
            currency: data.currency,
            conditions: data.conditions,
            message: data.message ?? null,
            statusAfter: "SUBMITTED",
          },
        },
      },
    });
    if (data.dueDiligenceRequested || property.category === "LAND") await createChecklist(tx, offer.id);
    const convo = await ensureConversation(tx, {
      subject: `Offer: ${property.title} (${property.reference})`,
      propertyId: property.id,
      userIds: [actor.id, property.listerId],
      offerId: offer.id,
    });
    await postSystemMessage(tx, convo.id, actor.id, `Offer submitted: ${formatMoney(amountMinor, data.currency)}.`);
    await notify(
      [{ userId: property.listerId, type: "offer.submitted", title: `New offer on ${property.reference}`, body: `${actor.name} offered ${formatMoney(amountMinor, data.currency)}.`, link: `/dashboard/offers/${offer.id}`, email: true }],
      tx,
    );
    return offer;
  });
}

function sideOf(actor: Actor, offer: { buyerId: string; property: { listerId: string; ownerId: string } }): OfferSide | null {
  if (offer.property.listerId === actor.id || offer.property.ownerId === actor.id) return "SELLER";
  if (offer.buyerId === actor.id) return "BUYER";
  return null;
}

export async function actOnOffer(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const data = offerActionSchema.parse(input);
  // Lapse an offer whose expiry has passed before acting on it, so nobody can accept stale terms.
  await expireOffers(new Date(), id);
  return db.$transaction(async (tx) => {
    // Lock the offer row so concurrent accept/counter requests are applied one at a time.
    await tx.$executeRaw`SELECT 1 FROM purchase_offers WHERE id = ${id} FOR UPDATE`;
    const offer = await tx.offer.findUnique({
      where: { id },
      include: { property: { select: { id: true, title: true, reference: true, listerId: true, ownerId: true, purpose: true } } },
    });
    if (!offer) throw notFound("Offer");
    const side = sideOf(actor, offer);
    if (!side) throw notFound("Offer");
    const next = offerMachine.next(offer.status, data.action, side);
    let amountMinor: bigint | null = null;
    if (data.action === "counter" || data.action === "buyer_counter") {
      if (!data.amount) throw new AppError("VALIDATION", "Enter the amount for your counteroffer", { amount: "Required" });
      amountMinor = parseMajorToMinor(data.amount, offer.currency)!;
    }
    const updated = await tx.offer.update({
      where: { id },
      data: {
        status: next,
        ...(amountMinor !== null ? { currentAmountMinor: amountMinor } : {}),
        ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
      },
    });
    await tx.offerEvent.create({
      data: {
        offerId: id,
        type: OFFER_ACTION_EVENT[data.action],
        actorId: actor.id,
        actorSide: side,
        amountMinor,
        currency: amountMinor !== null ? offer.currency : null,
        conditions: data.conditions ?? [],
        message: data.message ?? null,
        statusAfter: next,
      },
    });

    if (data.action === "accept" || data.action === "accept_counter") {
      await tx.property.update({ where: { id: offer.propertyId }, data: { availability: "UNDER_OFFER" } });
    }
    if (data.action === "start_due_diligence") await createChecklist(tx, id);
    if (data.action === "complete") {
      await tx.property.update({ where: { id: offer.propertyId }, data: { availability: offer.property.purpose === "SALE" ? "SOLD" : "UNAVAILABLE" } });
      await tx.propertyStatusHistory.create({
        data: { propertyId: offer.propertyId, field: "availability", toValue: offer.property.purpose === "SALE" ? "SOLD" : "UNAVAILABLE", reason: `Offer ${id} completed`, actorId: actor.id },
      });
      await audit({ actorId: actor.id, action: "offer.complete", targetType: "Offer", targetId: id, ipHash }, tx);
    }
    if ((data.action === "reject" || data.action === "withdraw") && ["ACCEPTED_IN_PRINCIPLE", "PENDING_DUE_DILIGENCE", "TRANSACTION_IN_PROGRESS"].includes(offer.status)) {
      await tx.property.update({ where: { id: offer.propertyId }, data: { availability: "AVAILABLE" } });
    }

    const otherId = side === "SELLER" ? offer.buyerId : offer.property.listerId;
    let body = `Status: ${OFFER_STATUS_LABELS[next]}.`;
    if (amountMinor !== null) body = `${side === "SELLER" ? "Counteroffer" : "New offer"}: ${formatMoney(amountMinor, offer.currency)}.`;
    if (data.message) body += ` ${data.message}`;
    await notify([{ userId: otherId, type: `offer.${data.action}`, title: `Offer update on ${offer.property.reference}`, body, link: `/dashboard/offers/${id}`, email: true }], tx);
    const convo = await tx.conversation.findUnique({ where: { offerId: id } });
    if (convo) await postSystemMessage(tx, convo.id, actor.id, body);
    return updated;
  });
}

const offerInclude = {
  property: { select: { id: true, title: true, slug: true, listerId: true, ownerId: true, priceMinor: true, currency: true } },
  buyer: { select: { id: true, profile: { select: { fullName: true } } } },
  events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { profile: { select: { fullName: true } } } } } },
} satisfies Prisma.OfferInclude;

function toDto(actor: Actor, o: Prisma.OfferGetPayload<{ include: typeof offerInclude }>): OfferDTO {
  const side = sideOf(actor, o) as "BUYER" | "SELLER";
  return {
    id: o.id,
    status: o.status,
    property: { id: o.property.id, title: o.property.title, slug: o.property.slug },
    buyer: { id: o.buyer.id, name: o.buyer.profile?.fullName ?? "Buyer" },
    currentAmount: { amountMinor: o.currentAmountMinor.toString(), currency: o.currency, formatted: formatMoney(o.currentAmountMinor, o.currency) },
    askingPrice: { amountMinor: o.property.priceMinor.toString(), currency: o.property.currency, formatted: formatMoney(o.property.priceMinor, o.property.currency) },
    paymentArrangement: o.paymentArrangement,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    myRole: side,
    actions: offerMachine.available(o.status, side),
    events: o.events.map((e) => ({
      id: e.id,
      type: e.type,
      actorName: e.actorSide === "SYSTEM" ? "System" : (e.actor?.profile?.fullName ?? "User"),
      actorSide: e.actorSide,
      amount: e.amountMinor !== null && e.currency ? { amountMinor: e.amountMinor.toString(), currency: e.currency, formatted: formatMoney(e.amountMinor, e.currency) } : null,
      conditions: e.conditions,
      message: e.message,
      statusAfter: e.statusAfter,
      createdAt: e.createdAt.toISOString(),
    })),
    createdAt: o.createdAt.toISOString(),
  };
}

export async function listOffers(actorIn: Actor | null) {
  const actor = assertActor(actorIn);
  const rows = await db.offer.findMany({
    where: { OR: [{ buyerId: actor.id }, { property: { listerId: actor.id } }, { property: { ownerId: actor.id } }] },
    include: offerInclude,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows.map((o) => toDto(actor, o));
}

export async function getOffer(actorIn: Actor | null, id: string) {
  const actor = assertActor(actorIn);
  const o = await db.offer.findUnique({ where: { id }, include: { ...offerInclude, dueDiligence: { orderBy: { sortOrder: "asc" } }, conversation: { select: { id: true } } } });
  if (!o || !sideOf(actor, o)) throw notFound("Offer");
  return { ...toDto(actor, o), dueDiligence: o.dueDiligence, conversationId: o.conversation?.id ?? null };
}

export async function updateDueDiligenceItem(actorIn: Actor | null, itemId: string, input: unknown) {
  const actor = assertActor(actorIn);
  const data = dueDiligenceUpdateSchema.parse(input);
  const item = await db.dueDiligenceItem.findUnique({ where: { id: itemId }, include: { offer: { include: { property: { select: { listerId: true, ownerId: true } } } } } });
  if (!item || !sideOf(actor, item.offer)) throw notFound("Checklist item");
  return db.dueDiligenceItem.update({ where: { id: itemId }, data: { status: data.status, notes: data.notes ?? null, updatedById: actor.id } });
}

/** Scheduled job: expire live offers past their expiry date. Safe to run repeatedly. */
export async function expireOffers(now = new Date(), onlyId?: string) {
  const due = await db.offer.findMany({
    where: { ...(onlyId ? { id: onlyId } : {}), expiresAt: { lt: now }, status: { in: ["SUBMITTED", "UNDER_REVIEW", "COUNTEROFFER_RECEIVED"] } },
    select: { id: true, status: true },
  });
  for (const o of due) {
    await db.$transaction([
      db.offer.update({ where: { id: o.id }, data: { status: offerMachine.next(o.status, "expire", "SYSTEM") } }),
      db.offerEvent.create({ data: { offerId: o.id, type: "EXPIRED", actorSide: "SYSTEM", statusAfter: "EXPIRED", conditions: [] } }),
    ]);
  }
  return due.length;
}
