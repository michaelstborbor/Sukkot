import "server-only";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_PURPOSE_LABELS,
  PLATFORM_COLLECTED_PURPOSES,
  PROVIDER_VERIFIED_METHODS,
  formatMoney,
  manualPaymentReviewSchema,
  manualPlatformPaymentSchema,
  parseMajorToMinor,
  paymentInitiateSchema,
  paymentRecordSchema,
  type ManualPlatformChannel,
  type PaymentDTO,
  type PaymentMethod,
} from "@sukkot/shared";
import { Prisma, type Currency, type PaymentPurpose, type PaymentStatus, type PaymentTransaction } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { db, type Tx } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor, assertPermission, can } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";
import { env } from "../env";
import { getSetting } from "../services/settings";
import { FEATURED_PERIOD_DAYS, featuredStart, renewalStart } from "../services/billing";
import { afrimoneyProvider } from "./providers/afrimoney";
import { orangeMoneyProvider } from "./providers/orange-money";
import { sandboxProvider } from "./providers/sandbox";
import { WebhookSignatureError, type PaymentProvider, type StoredTransaction } from "./types";

const PROVIDERS: Partial<Record<PaymentMethod, PaymentProvider>> = {
  ORANGE_MONEY: orangeMoneyProvider,
  AFRIMONEY: afrimoneyProvider,
  SANDBOX: sandboxProvider,
};

export function providerFor(method: PaymentMethod) {
  return PROVIDERS[method] ?? null;
}

/** Online methods that are switched on AND have credentials. Shown at checkout. */
export function availableOnlineMethods(): PaymentMethod[] {
  return (Object.keys(PROVIDERS) as PaymentMethod[]).filter(
    (m) => env.paymentMethodsEnabled.includes(m) && PROVIDERS[m]!.isConfigured(),
  );
}

function newReference() {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Allowed status changes. Terminal states never move except SUCCEEDED → REFUNDED/DISPUTED. */
const ALLOWED: Record<PaymentStatus, PaymentStatus[]> = {
  CREATED: ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "DISPUTED"],
  PENDING: ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "DISPUTED"],
  SUCCEEDED: ["REFUNDED", "DISPUTED"],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
  RECORDED: ["DISPUTED", "REFUNDED"],
  DISPUTED: ["SUCCEEDED", "RECORDED", "REFUNDED"],
};
export const canMovePayment = (from: PaymentStatus, to: PaymentStatus) => ALLOWED[from].includes(to);

export function toPaymentDto(p: PaymentTransaction): PaymentDTO {
  return {
    id: p.id,
    reference: p.reference,
    method: p.method,
    purpose: p.purpose,
    status: p.status,
    amount: { amountMinor: p.amountMinor.toString(), currency: p.currency, formatted: formatMoney(p.amountMinor, p.currency) },
    providerVerified: p.providerVerified,
    createdAt: p.createdAt.toISOString(),
    nextAction: p.status === "PENDING" || p.status === "CREATED" ? ((p.nextAction as PaymentDTO["nextAction"]) ?? null) : null,
  };
}

interface PricedItem {
  amountMinor: bigint;
  currency: Currency;
  description: string;
  planId?: string;
  propertyId?: string;
}

/** Price a plan or promotion on the server. Whatever amount a client sends is never used. */
async function pricePlatformItem(
  userId: string,
  purpose: PaymentPurpose,
  ids: { subscriptionPlanId?: string; propertyId?: string },
): Promise<PricedItem> {
  if (purpose === "PLATFORM_SUBSCRIPTION") {
    const plan = ids.subscriptionPlanId ? await db.subscriptionPlan.findFirst({ where: { id: ids.subscriptionPlanId, isActive: true } }) : null;
    if (!plan) throw new AppError("VALIDATION", "Choose a plan", { subscriptionPlanId: "Required" });
    if (plan.priceMinor <= 0n) throw new AppError("BAD_REQUEST", "This plan is free; no payment is needed");
    return { amountMinor: plan.priceMinor, currency: plan.currency, description: `${plan.name} plan`, planId: plan.id };
  }
  if (purpose === "LISTING_PROMOTION") {
    const property = ids.propertyId ? await db.property.findUnique({ where: { id: ids.propertyId }, select: { id: true, reference: true, listerId: true, ownerId: true, listingStatus: true } }) : null;
    if (!property || (property.listerId !== userId && property.ownerId !== userId)) throw notFound("Listing");
    if (property.listingStatus !== "PUBLISHED") throw new AppError("CONFLICT", "Only published listings can be promoted");
    const price = await getSetting("promotion.featured7d");
    if (!price) throw new AppError("NOT_CONFIGURED", "Listing promotion is not on sale yet");
    return { amountMinor: BigInt(price.priceMinor), currency: price.currency, description: `Featured listing ${property.reference}`, propertyId: property.id };
  }
  throw new AppError("NOT_CONFIGURED", "Platform fees are not enabled");
}

/**
 * Start an online payment for something the platform itself sells (subscription, promotion, fee).
 * Rent, deposits and sale proceeds flow directly between the parties and are recorded, not collected.
 * The amount is always computed on the server from the plan or price setting.
 */
export async function initiatePayment(actorIn: Actor | null, input: unknown) {
  const actor = assertActor(actorIn);
  const data = paymentInitiateSchema.parse(input);

  const existing = await db.paymentTransaction.findUnique({
    where: { idempotencyKey_payerId: { idempotencyKey: data.idempotencyKey, payerId: actor.id } },
  });
  if (existing) return toPaymentDto(existing);

  if (!PLATFORM_COLLECTED_PURPOSES.includes(data.purpose)) {
    throw new AppError("BAD_REQUEST", "Rent, deposits and sale payments are paid directly to the other party and recorded here. Sukkot Salone does not hold client funds.");
  }
  const provider = providerFor(data.method);
  if (!provider || !availableOnlineMethods().includes(data.method)) {
    throw new AppError("NOT_CONFIGURED", `${data.method.replace("_", " ")} payments are not available yet`);
  }
  if ((data.method === "AFRIMONEY" || data.method === "ORANGE_MONEY") && !data.payerPhone) {
    throw new AppError("VALIDATION", "Enter the mobile money number to charge", { payerPhone: "Required" });
  }

  const item = await pricePlatformItem(actor.id, data.purpose, data);
  const { amountMinor, currency, description, propertyId } = item;
  const subscriptionId = item.planId
    ? (await db.subscription.create({ data: { userId: actor.id, planId: item.planId, status: "PENDING_PAYMENT" } })).id
    : undefined;

  const reference = newReference();
  const tx = await db.paymentTransaction.create({
    data: {
      reference,
      idempotencyKey: data.idempotencyKey,
      method: data.method,
      purpose: data.purpose,
      status: "CREATED",
      amountMinor,
      currency,
      payerId: actor.id,
      payerPhone: data.payerPhone ?? null,
      subscriptionId,
      propertyId,
      events: { create: { type: "created", source: "api", statusAfter: "CREATED" } },
    },
  });

  let result;
  try {
    result = await provider.initiate({
      reference,
      amountMinor,
      currency,
      payerPhone: data.payerPhone ?? null,
      description,
      returnUrl: `${env.appUrl}/dashboard/payments?ref=${reference}`,
      cancelUrl: `${env.appUrl}/dashboard/payments?ref=${reference}&cancelled=1`,
      notifyUrl: `${env.appUrl}/api/v1/payments/webhooks/${data.method.toLowerCase()}?ref=${reference}`,
    });
  } catch (err) {
    console.error("[payments] initiate failed", err);
    result = { providerReference: null, status: "FAILED" as const, nextAction: null, raw: { error: "provider_unreachable" } };
  }
  const updated = await db.paymentTransaction.update({
    where: { id: tx.id },
    data: {
      status: result.status,
      providerReference: result.providerReference,
      nextAction: result.nextAction ?? Prisma.DbNull,
      providerData: (result.providerData as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
      events: { create: { type: "initiated", source: data.method, statusBefore: "CREATED", statusAfter: result.status, payload: (result.raw ?? null) as Prisma.InputJsonValue } },
    },
  });
  if (result.status === "FAILED") throw new AppError("PAYMENT_PROVIDER", "The payment provider could not start this payment. Please try again.");
  return toPaymentDto(updated);
}

async function fulfil(tx: Tx, p: PaymentTransaction) {
  if (p.purpose === "PLATFORM_SUBSCRIPTION" && p.subscriptionId) {
    const sub = await tx.subscription.findUnique({ where: { id: p.subscriptionId }, include: { plan: true } });
    if (sub && sub.status === "PENDING_PAYMENT") {
      // A renewal bought before the current period ends starts when that period ends.
      const startsAt = await renewalStart(sub.userId, sub.planId, tx);
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: "ACTIVE", startsAt, endsAt: new Date(startsAt.getTime() + sub.plan.periodDays * 86400_000) },
      });
    }
  }
  if (p.purpose === "LISTING_PROMOTION" && p.propertyId) {
    const startsAt = await featuredStart(p.propertyId, tx);
    await tx.featuredListing.create({ data: { propertyId: p.propertyId, startsAt, endsAt: new Date(startsAt.getTime() + FEATURED_PERIOD_DAYS * 86400_000), source: `payment:${p.reference}` } });
    await tx.property.update({ where: { id: p.propertyId }, data: { isFeatured: true } });
  }
  if (p.payerId) {
    await notify([{ userId: p.payerId, type: "payment.succeeded", title: "Payment confirmed", body: `${formatMoney(p.amountMinor, p.currency)} for ${PAYMENT_PURPOSE_LABELS[p.purpose]} was confirmed${p.providerVerified ? " by the provider" : " by Sukkot Salone finance"}.`, link: "/dashboard/payments" }], tx);
  }
}

function toStored(p: PaymentTransaction): StoredTransaction {
  return { reference: p.reference, providerReference: p.providerReference, amountMinor: p.amountMinor, currency: p.currency, providerData: (p.providerData as Record<string, unknown>) ?? null };
}

/**
 * Process a provider callback. Idempotent: duplicate deliveries are recorded once and ignored.
 * A payment becomes SUCCEEDED only when the callback authenticates, the amount matches, and —
 * where the provider supports it — a direct status query agrees.
 */
export async function handleWebhook(method: PaymentMethod, req: { headers: Headers; rawBody: string; url: string }) {
  const provider = providerFor(method);
  if (!provider || !provider.isConfigured()) throw new AppError("NOT_FOUND", "Unknown payment provider");
  let result;
  try {
    result = await provider.parseWebhook(req, async (ref) => {
      const p = await db.paymentTransaction.findFirst({
        where: ref.reference ? { reference: ref.reference, method } : { providerReference: ref.providerReference, method },
      });
      return p ? toStored(p) : null;
    });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      await audit({ actorId: null, action: "payment.webhook_rejected", targetType: "PaymentProvider", targetId: method, metadata: { reason: err.message } });
      throw new AppError("FORBIDDEN", "Invalid signature");
    }
    throw err;
  }

  const payment = await db.paymentTransaction.findFirst({
    where: result.reference ? { reference: result.reference, method } : { providerReference: result.providerReference, method },
  });
  if (!payment) throw notFound("Payment");

  // Duplicate delivery → acknowledge without reprocessing.
  const dup = await db.paymentEvent.findUnique({ where: { dedupeKey: result.eventId } });
  if (dup) return { status: payment.status, duplicate: true };

  let target = result.status as PaymentStatus;
  let note: string | null = null;
  if (result.amountMinor !== undefined && result.amountMinor !== payment.amountMinor) {
    target = "DISPUTED";
    note = "Amount in callback does not match the transaction";
  }
  if (result.currency && result.currency !== payment.currency) {
    target = "DISPUTED";
    note = "Currency in callback does not match the transaction";
  }
  if (target === "SUCCEEDED" && provider.queryStatus) {
    const confirmed = await provider.queryStatus(toStored(payment)).catch(() => "PENDING" as const);
    if (confirmed !== "SUCCEEDED") {
      target = "PENDING";
      note = `Callback said success but status query returned ${confirmed}`;
    }
  }

  return db.$transaction(async (tx) => {
    const fresh = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } });
    const move = target !== fresh.status && canMovePayment(fresh.status, target);
    await tx.paymentEvent.create({
      data: {
        transactionId: fresh.id,
        type: "webhook",
        source: method,
        statusBefore: fresh.status,
        statusAfter: move ? target : fresh.status,
        dedupeKey: result.eventId,
        payload: { ...(result.raw as object), note } as Prisma.InputJsonValue,
        signatureOk: true,
      },
    });
    if (!move) return { status: fresh.status, duplicate: false };
    const updated = await tx.paymentTransaction.update({
      where: { id: fresh.id },
      data: {
        status: target,
        providerVerified: target === "SUCCEEDED",
        paidAt: target === "SUCCEEDED" ? new Date() : fresh.paidAt,
        providerReference: fresh.providerReference ?? result.providerReference ?? null,
      },
    });
    if (target === "SUCCEEDED") await fulfil(tx, updated);
    return { status: updated.status, duplicate: false };
  });
}

/** Re-check a pending payment with the provider (e.g. when a callback was lost). */
export async function refreshPaymentStatus(actorIn: Actor | null, id: string) {
  const actor = assertActor(actorIn);
  const p = await db.paymentTransaction.findUnique({ where: { id } });
  if (!p || (p.payerId !== actor.id && !can(actor, "admin:payments.manage"))) throw notFound("Payment");
  const provider = providerFor(p.method);
  if (!provider?.queryStatus || !["CREATED", "PENDING"].includes(p.status)) return toPaymentDto(p);
  const status = await provider.queryStatus(toStored(p));
  if (status === p.status || !canMovePayment(p.status, status)) return toPaymentDto(p);
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.paymentTransaction.update({
      where: { id },
      data: { status, providerVerified: status === "SUCCEEDED", paidAt: status === "SUCCEEDED" ? new Date() : null, events: { create: { type: "status_query", source: p.method, statusBefore: p.status, statusAfter: status } } },
    });
    if (status === "SUCCEEDED") await fulfil(tx, u);
    return u;
  });
  return toPaymentDto(updated);
}

/* ------------------------------------------- Plans and promotions paid by transfer */

/** How a customer paid Sukkot Salone by transfer. Kept beside the transaction, never sent to other users. */
export function manualChannelOf(p: Pick<PaymentTransaction, "providerData">): ManualPlatformChannel | null {
  const data = p.providerData as { manualChannel?: ManualPlatformChannel } | null;
  return data?.manualChannel ?? null;
}

/** Waiting for finance to check a transfer. */
export const isAwaitingFinance = (p: Pick<PaymentTransaction, "status" | "payeeId" | "purpose" | "providerData">) =>
  p.status === "PENDING" && p.payeeId === null && PLATFORM_COLLECTED_PURPOSES.includes(p.purpose) && manualChannelOf(p) !== null;

/**
 * A customer says they paid for a plan or promotion by sending money to Sukkot Salone's own Orange
 * Money or Afrimoney number or bank account. Nothing is activated until finance staff find the
 * transaction on the statement and confirm it.
 */
export async function submitManualPlatformPayment(actorIn: Actor | null, input: unknown) {
  const actor = assertActor(actorIn);
  const data = manualPlatformPaymentSchema.parse(input);
  const existing = await db.paymentTransaction.findUnique({ where: { idempotencyKey_payerId: { idempotencyKey: data.idempotencyKey, payerId: actor.id } } });
  if (existing) return toPaymentDto(existing);
  const settings = await getSetting("billing.manual");
  if (!settings.enabled) throw new AppError("NOT_CONFIGURED", "Paying by transfer is not available yet");

  const externalReference = data.externalReference.replace(/\s+/g, "").toUpperCase();
  const reused = await db.paymentTransaction.findFirst({
    where: { externalReference, payeeId: null, purpose: { in: [...PLATFORM_COLLECTED_PURPOSES] }, status: { notIn: ["FAILED", "CANCELLED", "EXPIRED"] } },
    select: { id: true },
  });
  if (reused) throw new AppError("CONFLICT", "This transaction ID has already been submitted", { externalReference: "Already used" });

  const item = await pricePlatformItem(actor.id, data.purpose, data);
  const method: PaymentMethod = data.channel === "BANK_TRANSFER" ? "BANK_TRANSFER" : "MANUAL";
  const p = await db.$transaction(async (tx) => {
    const sub = item.planId ? await tx.subscription.create({ data: { userId: actor.id, planId: item.planId, status: "PENDING_PAYMENT" } }) : null;
    const created = await tx.paymentTransaction.create({
      data: {
        reference: newReference(),
        idempotencyKey: data.idempotencyKey,
        method,
        purpose: data.purpose,
        status: "PENDING",
        amountMinor: item.amountMinor,
        currency: item.currency,
        payerId: actor.id,
        payerPhone: data.payerPhone ?? null,
        recordedById: actor.id,
        subscriptionId: sub?.id,
        propertyId: item.propertyId,
        externalReference,
        notes: item.description,
        providerData: { manualChannel: data.channel },
        events: { create: { type: "transfer_submitted", source: "payer", statusAfter: "PENDING", payload: { channel: data.channel } } },
      },
    });
    const finance = await tx.userRoleAssignment.findMany({ where: { role: { in: ["FINANCE", "SUPER_ADMIN"] } }, select: { userId: true }, distinct: ["userId"] });
    await notify(
      finance.map((f) => ({
        userId: f.userId,
        type: "payment.awaiting_finance",
        title: "Transfer to check",
        body: `${formatMoney(item.amountMinor, item.currency)} for ${item.description}, ${PAYMENT_METHOD_LABELS[data.channel]} transaction ${externalReference}.`,
        link: "/admin/payments?status=AWAITING",
      })),
      tx,
    );
    return created;
  });
  return toPaymentDto(p);
}

/**
 * Finance staff confirm or reject a transfer after checking Sukkot Salone's wallet or bank statement.
 * A confirmed transfer is marked RECORDED (checked by a person), never provider-verified.
 */
export async function reviewManualPayment(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:payments.manage");
  const { approve, reason } = manualPaymentReviewSchema.parse(input);
  return db.$transaction(async (tx) => {
    const p = await tx.paymentTransaction.findUnique({ where: { id } });
    if (!p || !isAwaitingFinance(p)) throw new AppError("CONFLICT", "This payment is not waiting for a finance check");
    if (p.payerId === actor.id) throw forbidden("You cannot confirm your own payment");
    const status: PaymentStatus = approve ? "RECORDED" : "FAILED";
    const updated = await tx.paymentTransaction.update({
      where: { id, status: "PENDING" },
      data: {
        status,
        paidAt: approve ? new Date() : null,
        confirmedByPayeeAt: approve ? new Date() : null,
        events: { create: { type: approve ? "finance_confirmed" : "finance_rejected", source: "finance", statusBefore: p.status, statusAfter: status, payload: { by: actor.id, reason: reason ?? null } } },
      },
    });
    if (approve) {
      await fulfil(tx, updated);
    } else {
      if (p.subscriptionId) await tx.subscription.updateMany({ where: { id: p.subscriptionId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
      if (p.payerId) {
        await notify([{ userId: p.payerId, type: "payment.rejected", title: "Payment not found", body: `We could not match ${formatMoney(p.amountMinor, p.currency)} (transaction ${p.externalReference}) to our statement: ${reason}`, link: "/dashboard/billing", email: true }], tx);
      }
    }
    await audit({ actorId: actor.id, action: approve ? "payment.finance_confirm" : "payment.finance_reject", targetType: "PaymentTransaction", targetId: id, metadata: { reference: p.reference, reason: reason ?? null }, ipHash }, tx);
    return toPaymentDto(updated);
  });
}

/**
 * Record a payment made outside the platform (cash, bank transfer, mobile money to the landlord).
 * Recorded by the payee → RECORDED. Recorded by the payer → PENDING until the payee confirms.
 * Never marked provider-verified.
 */
export async function recordPayment(actorIn: Actor | null, input: unknown) {
  const actor = assertActor(actorIn);
  const data = paymentRecordSchema.parse(input);
  const existing = await db.paymentTransaction.findUnique({ where: { idempotencyKey_payerId: { idempotencyKey: data.idempotencyKey, payerId: actor.id } } });
  if (existing) return toPaymentDto(existing);
  const amountMinor = parseMajorToMinor(data.amount, data.currency)!;
  let payerId: string;
  let payeeId: string;
  let propertyId: string | null = null;
  if (data.tenancyId) {
    const t = await db.tenancy.findUnique({ where: { id: data.tenancyId } });
    if (!t || (t.tenantId !== actor.id && t.landlordId !== actor.id)) throw notFound("Tenancy");
    if (t.currency !== data.currency) throw new AppError("VALIDATION", `This tenancy is in ${t.currency}`, { currency: "Currency mismatch" });
    payerId = t.tenantId;
    payeeId = t.landlordId;
    propertyId = t.propertyId;
  } else if (data.offerId) {
    const o = await db.offer.findUnique({ where: { id: data.offerId }, include: { property: { select: { listerId: true, ownerId: true, id: true } } } });
    if (!o) throw notFound("Offer");
    const isSeller = o.property.listerId === actor.id || o.property.ownerId === actor.id;
    if (!isSeller && o.buyerId !== actor.id) throw notFound("Offer");
    if (!["ACCEPTED_IN_PRINCIPLE", "PENDING_DUE_DILIGENCE", "TRANSACTION_IN_PROGRESS", "COMPLETED"].includes(o.status)) {
      throw new AppError("CONFLICT", "Payments can be recorded once an offer is accepted in principle");
    }
    payerId = o.buyerId;
    payeeId = o.property.listerId;
    propertyId = o.property.id;
  } else {
    throw new AppError("VALIDATION", "Link the payment to a tenancy or an offer");
  }
  const byPayee = actor.id === payeeId;
  const p = await db.$transaction(async (tx) => {
    const created = await tx.paymentTransaction.create({
      data: {
        reference: newReference(),
        idempotencyKey: data.idempotencyKey,
        method: data.method,
        purpose: data.purpose,
        status: byPayee ? "RECORDED" : "PENDING",
        amountMinor,
        currency: data.currency,
        payerId,
        payeeId,
        recordedById: actor.id,
        propertyId,
        tenancyId: data.tenancyId,
        offerId: data.offerId,
        externalReference: data.externalReference,
        paidAt: data.paidAt,
        notes: data.notes,
        confirmedByPayeeAt: byPayee ? new Date() : null,
        events: { create: { type: "recorded", source: byPayee ? "payee" : "payer", statusAfter: byPayee ? "RECORDED" : "PENDING" } },
      },
    });
    if (byPayee && data.tenancyId) await applyToSchedule(tx, data.tenancyId, amountMinor);
    await notify(
      [{ userId: byPayee ? payerId : payeeId, type: "payment.recorded", title: byPayee ? "Payment receipt recorded" : "Please confirm a payment", body: `${formatMoney(amountMinor, data.currency)} (${PAYMENT_PURPOSE_LABELS[data.purpose]}) via ${data.method.replace("_", " ").toLowerCase()}.`, link: "/dashboard/payments" }],
      tx,
    );
    return created;
  });
  return toPaymentDto(p);
}

/** Allocate a confirmed amount to the earliest unpaid schedule rows. */
async function applyToSchedule(tx: Tx, tenancyId: string, amountMinor: bigint) {
  let remaining = amountMinor;
  const rows = await tx.rentScheduleItem.findMany({ where: { tenancyId, settledAt: null }, orderBy: { dueDate: "asc" } });
  for (const r of rows) {
    if (remaining <= 0n) break;
    const due = r.amountMinor - r.paidMinor;
    const pay = remaining < due ? remaining : due;
    remaining -= pay;
    await tx.rentScheduleItem.update({ where: { id: r.id }, data: { paidMinor: r.paidMinor + pay, settledAt: pay === due ? new Date() : null } });
  }
}

export async function confirmRecordedPayment(actorIn: Actor | null, id: string, confirm: boolean) {
  const actor = assertActor(actorIn);
  const p = await db.paymentTransaction.findUnique({ where: { id } });
  if (!p || p.payeeId !== actor.id) throw notFound("Payment");
  if (p.status !== "PENDING" || PROVIDER_VERIFIED_METHODS.includes(p.method) && p.providerReference) {
    throw new AppError("CONFLICT", "This payment does not need confirmation");
  }
  const status: PaymentStatus = confirm ? "RECORDED" : "DISPUTED";
  return db.$transaction(async (tx) => {
    const u = await tx.paymentTransaction.update({
      where: { id },
      data: { status, confirmedByPayeeAt: confirm ? new Date() : null, events: { create: { type: confirm ? "payee_confirmed" : "payee_disputed", source: "payee", statusBefore: p.status, statusAfter: status } } },
    });
    if (confirm && p.tenancyId) await applyToSchedule(tx, p.tenancyId, p.amountMinor);
    if (p.payerId) {
      await notify([{ userId: p.payerId, type: "payment.confirmation", title: confirm ? "Payment confirmed by recipient" : "Payment disputed by recipient", body: `${formatMoney(p.amountMinor, p.currency)} – ${confirm ? "confirmed" : "the recipient says they did not receive this"}.`, link: "/dashboard/payments" }], tx);
    }
    return toPaymentDto(u);
  });
}

export async function listMyPayments(actorIn: Actor | null) {
  const actor = assertActor(actorIn);
  const rows = await db.paymentTransaction.findMany({
    where: { OR: [{ payerId: actor.id }, { payeeId: actor.id }] },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { property: { select: { title: true, reference: true } } },
  });
  return rows.map((r) => ({ ...toPaymentDto(r), property: r.property, direction: r.payeeId === actor.id ? ("IN" as const) : ("OUT" as const), externalReference: r.externalReference, paidAt: r.paidAt?.toISOString() ?? null, needsMyConfirmation: r.payeeId === actor.id && r.status === "PENDING" && !r.providerReference }));
}

export async function getPaymentByReference(actorIn: Actor | null, reference: string) {
  const actor = assertActor(actorIn);
  const p = await db.paymentTransaction.findUnique({ where: { reference } });
  if (!p || (p.payerId !== actor.id && !can(actor, "admin:payments.view"))) throw forbidden();
  return p;
}
