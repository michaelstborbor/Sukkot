/**
 * Scheduled maintenance. Safe to run repeatedly (e.g. every 15 minutes from cron):
 *   pnpm --filter @sukkot/web jobs:expire
 * - expires offers past their expiry date
 * - ends featured promotions that have run out
 * - expires verification badges past their validity date
 * - removes expired sessions, auth tokens and rate-limit buckets
 * Pending payments are never expired here: a late provider confirmation must still be able to land.
 */
import { PrismaClient } from "@prisma/client";
import { offerMachine } from "@sukkot/shared";

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

    const badges = await db.verificationRequest.updateMany({ where: { status: "VERIFIED", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
    const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
    const tokens = await db.authToken.deleteMany({ where: { expiresAt: { lt: now } } });
    const buckets = await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } });

    console.log(
      JSON.stringify({ at: now.toISOString(), offersExpired: offers.length, promotionsEnded: unfeatured, badgesExpired: badges.count, sessions: sessions.count, tokens: tokens.count, rateLimitBuckets: buckets.count }),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
