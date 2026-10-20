import "server-only";
import {
  APPLICATION_STATUS_LABELS,
  applicationActionSchema,
  applicationMachine,
  formatMoney,
  parseMajorToMinor,
  rentalApplicationSchema,
  type ApplicationDTO,
  type ApplicationSide,
  type RentalPeriod,
} from "@sukkot/shared";
import type { Prisma, RentalApplication } from "@prisma/client";
import { db, type Tx } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor } from "../auth/actor";
import { notify } from "../notify";
import { ensureConversation, postSystemMessage } from "./messaging";
import { requireVerifiedEmail } from "./auth";

const PERIOD_MONTHS: Record<RentalPeriod, number> = { DAY: 0, WEEK: 0, MONTH: 1, QUARTER: 3, HALF_YEAR: 6, YEAR: 12 };

export async function createApplication(actorIn: Actor | null, input: unknown) {
  const actor = assertActor(actorIn);
  const data = rentalApplicationSchema.parse(input);
  await requireVerifiedEmail(actor.id, "apply to rent");
  const property = await db.property.findUnique({
    where: { id: data.propertyId },
    select: { id: true, title: true, reference: true, listerId: true, ownerId: true, listingStatus: true, purpose: true, availability: true },
  });
  if (!property || property.listingStatus !== "PUBLISHED") throw notFound("Listing");
  if (property.purpose === "SALE") throw new AppError("BAD_REQUEST", "This property is for sale. Make an offer instead.");
  if (property.listerId === actor.id || property.ownerId === actor.id) throw new AppError("BAD_REQUEST", "You cannot apply for your own listing");
  if (property.availability === "RENTED" || property.availability === "UNAVAILABLE") throw new AppError("CONFLICT", "This property is no longer available");
  if (data.moveInDate.getTime() < Date.now() - 86400_000) throw new AppError("VALIDATION", "Choose a move-in date in the future", { moveInDate: "In the past" });

  return db.$transaction(async (tx) => {
    const open = await tx.rentalApplication.findFirst({
      where: { propertyId: property.id, applicantId: actor.id, status: { notIn: ["REJECTED", "WITHDRAWN", "COMPLETED"] } },
      select: { id: true },
    });
    if (open) throw new AppError("CONFLICT", "You already have an open application for this property");
    const status = data.submit ? "SUBMITTED" : "DRAFT";
    const app = await tx.rentalApplication.create({
      data: {
        propertyId: property.id,
        applicantId: actor.id,
        status,
        moveInDate: data.moveInDate,
        leaseMonths: data.leaseMonths,
        occupants: data.occupants,
        employmentStatus: data.employmentStatus,
        employerOrBusiness: data.employerOrBusiness,
        monthlyIncomeBand: data.monthlyIncomeBand,
        currentAddress: data.currentAddress,
        referenceName: data.referenceName,
        referencePhone: data.referencePhone,
        message: data.message,
        submittedAt: data.submit ? new Date() : null,
        events: { create: { actorId: actor.id, action: data.submit ? "submit" : "create_draft", toStatus: status } },
      },
    });
    if (data.submit) await afterSubmit(tx, app, property, actor);
    return app;
  });
}

async function afterSubmit(
  tx: Tx,
  app: RentalApplication,
  property: { id: string; title: string; reference: string; listerId: string },
  actor: Actor,
) {
  const convo = await ensureConversation(tx, {
    subject: `Rental application: ${property.title} (${property.reference})`,
    propertyId: property.id,
    userIds: [actor.id, property.listerId],
    applicationId: app.id,
  });
  await postSystemMessage(tx, convo.id, actor.id, "Rental application submitted.");
  await notify(
    [{ userId: property.listerId, type: "application.submitted", title: `New rental application for ${property.reference}`, body: `${actor.name} applied to rent ${property.title}.`, link: `/dashboard/applications/${app.id}`, email: true }],
    tx,
  );
}

function sideOf(actor: Actor, app: { applicantId: string; property: { listerId: string; ownerId: string } }): ApplicationSide | null {
  if (app.property.listerId === actor.id || app.property.ownerId === actor.id) return "LANDLORD";
  if (app.applicantId === actor.id) return "APPLICANT";
  return null;
}

/** Build the rent schedule for a tenancy: one row per rental period across the lease, plus the deposit. */
export function buildRentSchedule(t: {
  startDate: Date;
  leaseMonths: number;
  rentMinor: bigint;
  currency: "SLE" | "USD";
  rentalPeriod: RentalPeriod;
  depositMinor: bigint | null;
}) {
  const rows: { dueDate: Date; amountMinor: bigint; currency: "SLE" | "USD"; label: string }[] = [];
  if (t.depositMinor && t.depositMinor > 0n) rows.push({ dueDate: t.startDate, amountMinor: t.depositMinor, currency: t.currency, label: "Security deposit" });
  const step = PERIOD_MONTHS[t.rentalPeriod];
  if (step === 0) {
    rows.push({ dueDate: t.startDate, amountMinor: t.rentMinor, currency: t.currency, label: "Rent" });
    return rows;
  }
  const count = Math.max(1, Math.ceil(t.leaseMonths / step));
  for (let i = 0; i < Math.min(count, 120); i++) {
    const due = new Date(t.startDate);
    due.setUTCMonth(due.getUTCMonth() + i * step);
    rows.push({ dueDate: due, amountMinor: t.rentMinor, currency: t.currency, label: `Rent period ${i + 1}` });
  }
  return rows;
}

export async function actOnApplication(actorIn: Actor | null, id: string, input: unknown) {
  const actor = assertActor(actorIn);
  const data = applicationActionSchema.parse(input);
  return db.$transaction(async (tx) => {
    const app = await tx.rentalApplication.findUnique({
      where: { id },
      include: { property: { select: { id: true, title: true, reference: true, listerId: true, ownerId: true, priceMinor: true, currency: true, rentalPeriod: true, rentalTerms: true } } },
    });
    if (!app) throw notFound("Application");
    const side = sideOf(actor, app);
    if (!side) throw notFound("Application");
    const next = applicationMachine.next(app.status, data.action, side);
    const update: Prisma.RentalApplicationUpdateInput = { status: next };

    if (data.action === "make_offer") {
      if (!data.terms) throw new AppError("VALIDATION", "Set out the proposed rent and terms", { terms: "Required" });
      const rent = parseMajorToMinor(data.terms.rent, data.terms.currency)!;
      const deposit = data.terms.securityDeposit ? parseMajorToMinor(data.terms.securityDeposit, data.terms.currency) : null;
      update.proposedTerms = {
        rentMinor: rent.toString(),
        currency: data.terms.currency,
        rentalPeriod: data.terms.rentalPeriod,
        advanceRentPeriods: data.terms.advanceRentPeriods,
        depositMinor: deposit?.toString() ?? null,
        startDate: data.terms.startDate.toISOString(),
        leaseMonths: data.terms.leaseMonths,
        conditions: data.terms.conditions ?? null,
      };
    }
    if (data.action === "submit") update.submittedAt = new Date();
    if (["approve", "reject", "accept_offer"].includes(data.action)) update.decidedAt = new Date();

    const updated = await tx.rentalApplication.update({ where: { id }, data: update });
    await tx.applicationEvent.create({ data: { applicationId: id, actorId: actor.id, action: data.action, fromStatus: app.status, toStatus: next, note: data.note } });

    if (data.action === "submit") {
      await afterSubmit(tx, updated, app.property, actor);
      return updated;
    }

    if (data.action === "complete") {
      const terms = (app.proposedTerms ?? null) as null | {
        rentMinor: string; currency: "SLE" | "USD"; rentalPeriod: RentalPeriod; advanceRentPeriods: number; depositMinor: string | null; startDate: string; leaseMonths: number; conditions: string | null;
      };
      const startDate = terms ? new Date(terms.startDate) : app.moveInDate;
      const leaseMonths = terms?.leaseMonths ?? app.leaseMonths;
      const endDate = new Date(startDate);
      endDate.setUTCMonth(endDate.getUTCMonth() + leaseMonths);
      const rentMinor = terms ? BigInt(terms.rentMinor) : app.property.priceMinor;
      const currency = terms?.currency ?? app.property.currency;
      const rentalPeriod = terms?.rentalPeriod ?? app.property.rentalPeriod ?? "MONTH";
      const depositMinor = terms?.depositMinor ? BigInt(terms.depositMinor) : null;
      await tx.tenancy.create({
        data: {
          propertyId: app.propertyId,
          tenantId: app.applicantId,
          landlordId: app.property.listerId,
          applicationId: app.id,
          status: startDate > new Date() ? "UPCOMING" : "ACTIVE",
          startDate,
          endDate,
          rentMinor,
          currency,
          rentalPeriod,
          depositMinor,
          advancePeriods: terms?.advanceRentPeriods ?? 0,
          terms: terms?.conditions ?? null,
          schedule: { create: buildRentSchedule({ startDate, leaseMonths, rentMinor, currency, rentalPeriod, depositMinor }) },
        },
      });
      await tx.property.update({ where: { id: app.propertyId }, data: { availability: "RENTED" } });
      await tx.propertyStatusHistory.create({
        data: { propertyId: app.propertyId, field: "availability", toValue: "RENTED", reason: `Tenancy from application ${app.id}`, actorId: actor.id },
      });
    }

    const otherId = side === "LANDLORD" ? app.applicantId : app.property.listerId;
    let body = `Status is now: ${APPLICATION_STATUS_LABELS[next]}.`;
    if (data.action === "make_offer" && data.terms) {
      body = `Proposed terms: ${formatMoney(parseMajorToMinor(data.terms.rent, data.terms.currency)!, data.terms.currency, { period: data.terms.rentalPeriod })}, ${data.terms.leaseMonths} months from ${data.terms.startDate.toDateString()}.`;
    }
    if (data.note) body += ` Note: ${data.note}`;
    await notify([{ userId: otherId, type: `application.${data.action}`, title: `Rental application ${APPLICATION_STATUS_LABELS[next].toLowerCase()}: ${app.property.reference}`, body, link: `/dashboard/applications/${id}`, email: true }], tx);
    const convo = await tx.conversation.findUnique({ where: { applicationId: id } });
    if (convo) await postSystemMessage(tx, convo.id, actor.id, body);
    return updated;
  });
}

const listInclude = {
  property: { select: { id: true, title: true, slug: true, listerId: true, ownerId: true } },
  applicant: { select: { id: true, profile: { select: { fullName: true } } } },
} satisfies Prisma.RentalApplicationInclude;

function toDto(actor: Actor, r: Prisma.RentalApplicationGetPayload<{ include: typeof listInclude }>): ApplicationDTO {
  const side = sideOf(actor, r)!;
  return {
    id: r.id,
    status: r.status,
    property: { id: r.property.id, title: r.property.title, slug: r.property.slug },
    applicant: { id: r.applicant.id, name: r.applicant.profile?.fullName ?? "Applicant" },
    moveInDate: r.moveInDate.toISOString(),
    leaseMonths: r.leaseMonths,
    occupants: r.occupants,
    myRole: side,
    actions: applicationMachine.available(r.status, side),
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listApplications(actorIn: Actor | null) {
  const actor = assertActor(actorIn);
  const rows = await db.rentalApplication.findMany({
    where: { OR: [{ applicantId: actor.id }, { property: { listerId: actor.id } }, { property: { ownerId: actor.id } }] },
    include: listInclude,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows.map((r) => toDto(actor, r));
}

export async function getApplication(actorIn: Actor | null, id: string) {
  const actor = assertActor(actorIn);
  const r = await db.rentalApplication.findUnique({
    where: { id },
    include: { ...listInclude, events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { profile: { select: { fullName: true } } } } } }, conversation: { select: { id: true } }, tenancy: { select: { id: true } } },
  });
  if (!r || !sideOf(actor, r)) throw notFound("Application");
  return { ...toDto(actor, r), details: r };
}
