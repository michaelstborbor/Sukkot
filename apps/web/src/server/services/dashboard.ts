import "server-only";
import { db } from "../db";
import type { Actor } from "../auth/session";
import { unreadMessageCount } from "./messaging";

const managed = (actorId: string) => ({ OR: [{ listerId: actorId }, { ownerId: actorId }] });

/** Overview numbers for the landlord/agent dashboard, all computed from live data. */
export async function listerOverview(actor: Actor) {
  const where = managed(actor.id);
  const since = new Date(Date.now() - 180 * 86400_000);
  const [byStatus, byAvailability, enquiries, unread, upcomingInspections, pendingApplications, activeOffers, recent] = await Promise.all([
    db.property.groupBy({ by: ["listingStatus"], where, _count: true }),
    db.property.groupBy({ by: ["availability"], where: { ...where, listingStatus: { not: "REMOVED" } }, _count: true }),
    db.enquiry.count({ where: { property: where } }),
    unreadMessageCount(actor.id),
    db.inspection.count({ where: { representativeId: actor.id, status: { in: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"] }, scheduledAt: { gte: new Date() } } }),
    db.rentalApplication.count({ where: { property: where, status: { in: ["SUBMITTED", "UNDER_REVIEW", "INSPECTION_REQUIRED", "OFFER_MADE"] } } }),
    db.offer.count({ where: { property: where, status: { in: ["SUBMITTED", "UNDER_REVIEW", "COUNTEROFFER_RECEIVED", "ACCEPTED_IN_PRINCIPLE", "PENDING_DUE_DILIGENCE", "TRANSACTION_IN_PROGRESS"] } } }),
    db.propertyStatusHistory.findMany({ where: { property: where }, orderBy: { createdAt: "desc" }, take: 8, include: { property: { select: { title: true, reference: true, id: true } } } }),
  ]);
  const status = Object.fromEntries(byStatus.map((s) => [s.listingStatus, s._count]));
  const avail = Object.fromEntries(byAvailability.map((s) => [s.availability, s._count]));
  const total = byStatus.reduce((n, s) => n + (s.listingStatus === "REMOVED" ? 0 : s._count), 0);

  const monthly = await db.$queryRaw<{ month: Date; enquiries: bigint }[]>`
    SELECT date_trunc('month', e."createdAt") AS month, COUNT(*)::bigint AS enquiries
    FROM enquiries e JOIN properties p ON p.id = e."propertyId"
    WHERE (p."listerId" = ${actor.id} OR p."ownerId" = ${actor.id}) AND e."createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1`;
  const views = await db.$queryRaw<{ month: Date; views: bigint }[]>`
    SELECT date_trunc('month', v.day) AS month, SUM(v.views)::bigint AS views
    FROM property_view_daily v JOIN properties p ON p.id = v."propertyId"
    WHERE (p."listerId" = ${actor.id} OR p."ownerId" = ${actor.id}) AND v.day >= ${since}
    GROUP BY 1 ORDER BY 1`;
  const income = await db.$queryRaw<{ month: Date; currency: string; amount: bigint }[]>`
    SELECT date_trunc('month', COALESCE(t."paidAt", t."createdAt")) AS month, t.currency::text AS currency, SUM(t."amountMinor")::bigint AS amount
    FROM payment_transactions t
    WHERE t."payeeId" = ${actor.id} AND t.status IN ('RECORDED', 'SUCCEEDED') AND COALESCE(t."paidAt", t."createdAt") >= ${since}
    GROUP BY 1, 2 ORDER BY 1`;

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const key = (d: Date) => new Date(d).toISOString().slice(0, 7);
  const series = months.map((m) => ({
    month: m,
    enquiries: Number(monthly.find((r) => key(r.month) === m)?.enquiries ?? 0),
    views: Number(views.find((r) => key(r.month) === m)?.views ?? 0),
    incomeSLE: Number(income.filter((r) => key(r.month) === m && r.currency === "SLE").reduce((n, r) => n + r.amount, 0n) / 100n),
  }));
  const totalViews = series.reduce((n, s) => n + s.views, 0);
  const totalEnq = series.reduce((n, s) => n + s.enquiries, 0);
  return {
    totals: {
      listings: total,
      active: status.PUBLISHED ?? 0,
      pending: (status.PENDING_REVIEW ?? 0) + (status.CHANGES_REQUESTED ?? 0),
      drafts: status.DRAFT ?? 0,
      rentedOrSold: (avail.RENTED ?? 0) + (avail.SOLD ?? 0),
      enquiries,
      unread,
      upcomingInspections,
      pendingApplications,
      activeOffers,
      conversionRate: totalViews > 0 ? Math.round((totalEnq / totalViews) * 1000) / 10 : null,
    },
    series,
    recent,
  };
}

/** Overview for tenants/buyers. */
export async function seekerOverview(actor: Actor) {
  const [saved, enquiries, inspections, applications, offers, unread] = await Promise.all([
    db.savedProperty.count({ where: { userId: actor.id } }),
    db.enquiry.count({ where: { userId: actor.id } }),
    db.inspection.count({ where: { requesterId: actor.id, status: { in: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"] } } }),
    db.rentalApplication.count({ where: { applicantId: actor.id, status: { notIn: ["WITHDRAWN", "REJECTED", "COMPLETED"] } } }),
    db.offer.count({ where: { buyerId: actor.id, status: { notIn: ["WITHDRAWN", "REJECTED", "EXPIRED", "COMPLETED"] } } }),
    unreadMessageCount(actor.id),
  ]);
  return { saved, enquiries, inspections, applications, offers, unread };
}
