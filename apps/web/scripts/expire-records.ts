/**
 * Scheduled maintenance. Safe to run repeatedly (e.g. every 15 minutes from cron):
 *   pnpm --filter @sukkot/web jobs:expire
 * - expires offers past their expiry date
 * - ends featured promotions that have run out
 * - expires verification badges past their validity date
 * - ends paid plans that have run out, and reminds subscribers a few days before (once per period)
 * - drops the search lift of plans that have run out (or moves it to a renewal that has started)
 * - removes expired sessions, auth tokens and rate-limit buckets
 * Pending payments are never expired here: a late provider confirmation must still be able to land.
 */
import { PrismaClient } from "@prisma/client";
import { offerMachine } from "@sukkot/shared";

const RENEWAL_REMINDER_DAYS = 3;

async function main() {
  const db = new PrismaClient();
  const now = new Date();
  try {
    const offers = await db.offer.findMany({
      where: { expiresAt: { lt: now }, status: { in: ["SUBMITTED", "UNDER_REVIEW", "COUNTEROFFER_RECEIVED"] } },
      select: { id: true, status: true },
    });
    for (const o of offers) {
      await db.$transaction([
        db.offer.update({ where: { id: o.id }, data: { status: offerMachine.next(o.status, "expire", "SYSTEM") } }),
        db.offerEvent.create({ data: { offerId: o.id, type: "EXPIRED", actorSide: "SYSTEM", statusAfter: "EXPIRED", conditions: [] } }),
      ]);
    }

    const endedPromos = await db.featuredListing.findMany({ where: { endsAt: { lt: now } }, select: { propertyId: true } });
    let unfeatured = 0;
    for (const { propertyId } of endedPromos) {
      const stillActive = await db.featuredListing.count({ where: { propertyId, endsAt: { gte: now } } });
      if (!stillActive) unfeatured += (await db.property.updateMany({ where: { id: propertyId, isFeatured: true }, data: { isFeatured: false } })).count;
    }

    // Plans: remind once, a few days before the end, unless a renewal is already queued.
    const soon = new Date(now.getTime() + RENEWAL_REMINDER_DAYS * 86400_000);
    const ending = await db.subscription.findMany({
      where: { status: "ACTIVE", reminderSentAt: null, endsAt: { gt: now, lte: soon } },
      include: { plan: { select: { name: true } } },
    });
    let reminded = 0;
    for (const s of ending) {
      const renewed = await db.subscription.count({ where: { userId: s.userId, planId: s.planId, status: "ACTIVE", endsAt: { gt: s.endsAt! } } });
      await db.$transaction(async (tx) => {
        const claimed = await tx.subscription.updateMany({ where: { id: s.id, reminderSentAt: null }, data: { reminderSentAt: now } });
        if (!claimed.count || renewed) return;
        await tx.notification.create({
          data: { userId: s.userId, type: "subscription.ending", title: `Your ${s.plan.name} plan ends soon`, body: `It ends on ${s.endsAt!.toISOString().slice(0, 10)}. Renew in Plans and billing to keep your listing allowance and featured listings.`, link: "/dashboard/billing" },
        });
        reminded++;
      });
    }
    const ended = await db.subscription.findMany({ where: { status: "ACTIVE", endsAt: { lt: now } }, include: { plan: { select: { name: true } } } });
    for (const s of ended) {
      await db.$transaction(async (tx) => {
        const moved = await tx.subscription.updateMany({ where: { id: s.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
        const renewed = await tx.subscription.count({ where: { userId: s.userId, status: "ACTIVE", endsAt: { gt: now } } });
        if (!moved.count || renewed) return;
        await tx.notification.create({
          data: { userId: s.userId, type: "subscription.ended", title: `Your ${s.plan.name} plan has ended`, body: "Your live listings stay up, but new listings now count against the free allowance. Renew any time in Plans and billing.", link: "/dashboard/billing" },
        });
      });
    }

    // Search lift from a plan that has run out: drop it, or carry on with a renewal that has started.
    const lifted = await db.user.findMany({ where: { searchBoost: { gt: 0 }, searchBoostUntil: { lt: now } }, select: { id: true } });
    for (const u of lifted) {
      const current = await db.subscription.findFirst({
        where: { userId: u.id, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
        include: { plan: { select: { searchBoost: true } } },
        orderBy: [{ plan: { searchBoost: "desc" } }, { endsAt: "desc" }],
      });
      const boost = current?.plan.searchBoost ?? 0;
      await db.user.update({ where: { id: u.id }, data: { searchBoost: boost, searchBoostUntil: boost ? current!.endsAt : null } });
    }

    const badges = await db.verificationRequest.updateMany({ where: { status: "VERIFIED", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
    const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
    const tokens = await db.authToken.deleteMany({ where: { expiresAt: { lt: now } } });
    const buckets = await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } });

    console.log(
      JSON.stringify({ at: now.toISOString(), offersExpired: offers.length, promotionsEnded: unfeatured, plansReminded: reminded, plansEnded: ended.length, searchLiftsUpdated: lifted.length, badgesExpired: badges.count, sessions: sessions.count, tokens: tokens.count, rateLimitBuckets: buckets.count }),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
