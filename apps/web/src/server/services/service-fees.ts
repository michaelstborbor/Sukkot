import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { CURRENCIES, emailSchema, formatMoney, parseMajorToMinor, PAYMENT_PURPOSE_LABELS } from "@sukkot/shared";
import type { PaymentPurpose, PaymentTransaction, Prisma, ServiceFee } from "@prisma/client";
import { db, type Tx } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";
import { getSetting } from "./settings";

/**
 * Sukkot Salone's success fee. Once a tenant or buyer has paid rent, lease or purchase money to the
 * landlord or seller, they owe Sukkot Salone a percentage of it (5% to start, set in Site settings):
 * - a rent or sale payment recorded by the landlord or seller, or confirmed by them, raises the fee
 *   automatically (security deposits are refundable and never charged);
 * - staff raise it by hand for a deal agreed through our team and paid outside the platform.
 * The tenant or buyer pays it like any other Sukkot Salone fee: mobile money, transfer to our account
 * (checked by finance), or directly to our team, which finance records. Nothing is marked paid
 * without the provider's confirmation or a finance check, and the rent or sale money itself never
 * passes through Sukkot Salone.
 */

/** Payments between the parties that a success fee is charged on. */
export const SUCCESS_FEE_BASE_PURPOSES: PaymentPurpose[] = ["RENT", "ADVANCE_RENT", "SALE_DEPOSIT", "SALE_PROCEEDS"];

export function newFeeReference() {
  return `FEE-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** The fee on `baseMinor` at `basisPoints` hundredths of a percent, rounded to the nearest minor unit. */
export function feeOn(baseMinor: bigint, basisPoints: number) {
  return (baseMinor * BigInt(basisPoints) + 5000n) / 10000n;
}

const percent = (bp: number) => `${bp / 100}%`;

/**
 * Raise the success fee on a rent or sale payment that has just been recorded or confirmed by the
 * person who received it. Does nothing when the fee is switched off, the payment is of another kind,
 * or a fee was already raised on it.
 */
export async function chargeServiceFee(tx: Tx, p: PaymentTransaction): Promise<ServiceFee | null> {
  if (!SUCCESS_FEE_BASE_PURPOSES.includes(p.purpose) || !p.payerId || p.status !== "RECORDED") return null;
  const setting = await getSetting("fees.success");
  if (!setting?.basisPoints) return null;
  if (await tx.serviceFee.findUnique({ where: { sourcePaymentId: p.id }, select: { id: true } })) return null;
  const amountMinor = feeOn(p.amountMinor, setting.basisPoints);
  if (amountMinor <= 0n) return null;
  const property = p.propertyId ? await tx.property.findUnique({ where: { id: p.propertyId }, select: { title: true, reference: true } }) : null;
  const what = PAYMENT_PURPOSE_LABELS[p.purpose].toLowerCase();
  const fee = await tx.serviceFee.create({
    data: {
      reference: newFeeReference(),
      payerId: p.payerId,
      propertyId: p.propertyId,
      sourcePaymentId: p.id,
      description: `${percent(setting.basisPoints)} service fee on ${formatMoney(p.amountMinor, p.currency)} ${what}${property ? ` for ${property.reference}` : ""}`,
      baseMinor: p.amountMinor,
      basisPoints: setting.basisPoints,
      amountMinor,
      currency: p.currency,
    },
  });
  await notify(
    [
      {
        userId: p.payerId,
        type: "fee.due",
        title: `Service fee due: ${formatMoney(amountMinor, p.currency)}`,
        body: `Your ${what} of ${formatMoney(p.amountMinor, p.currency)}${property ? ` for ${property.title}` : ""} has been confirmed. Sukkot Salone's ${percent(setting.basisPoints)} service fee of ${formatMoney(amountMinor, p.currency)} is now due. Pay it by mobile money, by transfer or directly to our team from Payments.`,
        link: "/dashboard/payments",
        email: true,
      },
    ],
    tx,
  );
  return fee;
}

/** Called when a payment for a service fee is confirmed by the provider or by finance. */
export async function settleServiceFee(tx: Tx, p: PaymentTransaction) {
  if (!p.serviceFeeId) return;
  await tx.serviceFee.updateMany({ where: { id: p.serviceFeeId, status: "DUE" }, data: { status: "PAID", paidAt: p.paidAt ?? new Date() } });
}

const raiseSchema = z.object({
  payerEmail: emailSchema,
  dealAmount: z.string().trim().min(1).max(20),
  currency: z.enum(CURRENCIES).default("SLE"),
  propertyReference: z.string().trim().max(30).optional().transform((v) => v || undefined),
  description: z.string().trim().min(5).max(300),
});

/** Staff raise the success fee for a deal agreed through our team, from the rent, lease or sale amount. */
export async function raiseServiceFee(actorIn: Actor | null, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:payments.manage");
  const data = raiseSchema.parse(input);
  const setting = await getSetting("fees.success");
  if (!setting?.basisPoints) throw new AppError("NOT_CONFIGURED", "The service fee is switched off in Site settings");
  const baseMinor = parseMajorToMinor(data.dealAmount, data.currency);
  if (!baseMinor || baseMinor <= 0n) throw new AppError("VALIDATION", "Enter the rent, lease or sale amount", { dealAmount: "Enter an amount" });
  const payer = await db.user.findUnique({ where: { email: data.payerEmail }, select: { id: true } });
  if (!payer) throw new AppError("VALIDATION", "No account uses that email address", { payerEmail: "Not found" });
  if (payer.id === actor.id) throw forbidden("You cannot raise a fee for yourself");
  const property = data.propertyReference ? await db.property.findUnique({ where: { reference: data.propertyReference.toUpperCase() }, select: { id: true, reference: true } }) : null;
  if (data.propertyReference && !property) throw new AppError("VALIDATION", "No listing has that reference", { propertyReference: "Not found" });
  const amountMinor = feeOn(baseMinor, setting.basisPoints);

  return db.$transaction(async (tx) => {
    const fee = await tx.serviceFee.create({
      data: {
        reference: newFeeReference(),
        payerId: payer.id,
        propertyId: property?.id,
        description: `${percent(setting.basisPoints)} service fee on ${formatMoney(baseMinor, data.currency)}: ${data.description}`,
        baseMinor,
        basisPoints: setting.basisPoints,
        amountMinor,
        currency: data.currency,
        raisedById: actor.id,
      },
    });
    await notify(
      [{ userId: payer.id, type: "fee.due", title: `Service fee due: ${formatMoney(amountMinor, data.currency)}`, body: `${fee.description}. Pay it by mobile money, by transfer or directly to our team from Payments.`, link: "/dashboard/payments", email: true }],
      tx,
    );
    await audit({ actorId: actor.id, action: "fee.raise", targetType: "ServiceFee", targetId: fee.id, metadata: { amountMinor: amountMinor.toString(), currency: data.currency, payerId: payer.id }, ipHash }, tx);
    return fee;
  });
}

const receivedSchema = z.object({
  method: z.enum(["CASH", "ORANGE_MONEY", "AFRIMONEY", "BANK_TRANSFER"]),
  externalReference: z.string().trim().min(3).max(60),
});

/**
 * Finance records a service fee paid directly to our team (cash, or money sent to our wallet or bank
 * outside checkout) after checking it arrived. The payment is marked RECORDED, never provider-verified.
 */
export async function recordServiceFeeReceived(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:payments.manage");
  const data = receivedSchema.parse(input);
  return db.$transaction(async (tx) => {
    const fee = await tx.serviceFee.findUnique({ where: { id } });
    if (!fee) throw notFound("Service fee");
    if (fee.status !== "DUE") throw new AppError("CONFLICT", "This fee is not due");
    if (fee.payerId === actor.id) throw forbidden("You cannot record your own payment");
    const now = new Date();
    const payment = await tx.paymentTransaction.create({
      data: {
        reference: `PAY-${now.getTime().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`,
        idempotencyKey: `fee-received-${fee.id}`,
        method: data.method === "CASH" ? "CASH" : data.method === "BANK_TRANSFER" ? "BANK_TRANSFER" : "MANUAL",
        purpose: "SUCCESS_FEE",
        status: "RECORDED",
        amountMinor: fee.amountMinor,
        currency: fee.currency,
        payerId: fee.payerId,
        recordedById: actor.id,
        propertyId: fee.propertyId,
        serviceFeeId: fee.id,
        externalReference: data.externalReference,
        paidAt: now,
        confirmedByPayeeAt: now,
        notes: fee.description,
        providerData: data.method === "ORANGE_MONEY" || data.method === "AFRIMONEY" ? ({ manualChannel: data.method } as Prisma.InputJsonValue) : undefined,
        events: { create: { type: "finance_recorded", source: "finance", statusAfter: "RECORDED", payload: { by: actor.id, method: data.method } } },
      },
    });
    await tx.serviceFee.update({ where: { id: fee.id }, data: { status: "PAID", paidAt: now } });
    await notify([{ userId: fee.payerId, type: "payment.succeeded", title: "Service fee received", body: `Our finance team recorded your ${formatMoney(fee.amountMinor, fee.currency)} service fee (${fee.reference}). Thank you.`, link: "/dashboard/payments" }], tx);
    await audit({ actorId: actor.id, action: "fee.record_received", targetType: "ServiceFee", targetId: fee.id, metadata: { paymentId: payment.id, method: data.method, externalReference: data.externalReference }, ipHash }, tx);
    return payment;
  });
}

/** Staff cancel a fee that should not be paid, for example a deal that fell through. */
export async function waiveServiceFee(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:payments.manage");
  const { reason } = z.object({ reason: z.string().trim().min(5).max(500) }).parse(input);
  const owed = await db.serviceFee.findUnique({ where: { id }, select: { payerId: true } });
  if (!owed) throw notFound("Service fee");
  if (owed.payerId === actor.id) throw forbidden("You cannot waive a fee you owe");
  return db.$transaction(async (tx) => {
    const moved = await tx.serviceFee.updateMany({ where: { id, status: "DUE" }, data: { status: "WAIVED", waivedReason: reason } });
    if (!moved.count) throw new AppError("CONFLICT", "Only a fee that is due can be waived");
    const fee = await tx.serviceFee.findUniqueOrThrow({ where: { id } });
    await notify([{ userId: fee.payerId, type: "fee.waived", title: "Service fee cancelled", body: `You no longer owe the ${formatMoney(fee.amountMinor, fee.currency)} service fee (${fee.reference}): ${reason}`, link: "/dashboard/payments" }], tx);
    await audit({ actorId: actor.id, action: "fee.waive", targetType: "ServiceFee", targetId: id, metadata: { reason }, ipHash }, tx);
    return fee;
  });
}

/** Service fees for the admin list, newest first. */
export function listServiceFees(status?: string) {
  const where: Prisma.ServiceFeeWhereInput = status === "DUE" || status === "PAID" || status === "WAIVED" ? { status } : {};
  return db.serviceFee.findMany({
    where,
    include: { payer: { select: { email: true, profile: { select: { fullName: true } } } }, property: { select: { reference: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** A customer's own service fees, unpaid first. */
export function myServiceFees(userId: string, client: Tx | typeof db = db) {
  return client.serviceFee.findMany({ where: { payerId: userId }, include: { property: { select: { title: true, reference: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 50 });
}
