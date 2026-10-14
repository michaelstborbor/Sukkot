import "server-only";
import type { Subscription, SubscriptionPlan } from "@prisma/client";
import { db, type Tx } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { getSetting } from "./settings";
import type { ManualPlatformChannel } from "@sukkot/shared";

type Client = Tx | typeof db;

/** Listing states that use up a plan's listing allowance. Drafts, paused and closed listings do not. */
export const COUNTED_LISTING_STATUSES = ["PENDING_REVIEW", "PUBLISHED"] as const;

/** One featured period, whether bought outright or taken from a plan's monthly allowance. */
export const FEATURED_PERIOD_DAYS = 7;

export type ActiveSubscription = Subscription & { plan: SubscriptionPlan };

/** Unlimited beats any number; otherwise the larger allowance wins. */
function stronger(a: SubscriptionPlan, b: SubscriptionPlan) {
  if (a.maxListings === null) return b.maxListings === null ? a.featuredSlots >= b.featuredSlots : true;
  if (b.maxListings === null) return false;
  return a.maxListings >= b.maxListings;
}

/** The paid subscription currently in force for a user, or null. Renewals queued for later are ignored. */
export async function activeSubscription(userId: string, client: Client = db, now = new Date()): Promise<ActiveSubscription | null> {
  const subs = await client.subscription.findMany({
    where: { userId, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
    include: { plan: true },
    orderBy: { endsAt: "asc" },
  });
  return subs.reduce<ActiveSubscription | null>((best, s) => (!best || !stronger(best.plan, s.plan) ? s : best), null);
}

/** The free plan everyone is on without a paid subscription (the cheapest active plan priced at zero). */
export function freePlan(client: Client = db) {
  return client.subscriptionPlan.findFirst({ where: { isActive: true, priceMinor: 0 }, orderBy: { sortOrder: "asc" } });
}

/** When a renewal of `planId` bought now would start: straight away, or when the current period of that plan ends. */
export async function renewalStart(userId: string, planId: string, client: Client = db, now = new Date()) {
  const latest = await client.subscription.findFirst({
    where: { userId, planId, status: "ACTIVE", endsAt: { gt: now } },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true },
  });
  return latest?.endsAt && latest.endsAt > now ? latest.endsAt : now;
}

/** When a new featured period for a listing would start: now, or when its current featured period ends. */
export async function featuredStart(propertyId: string, client: Client = db, now = new Date()) {
  const latest = await client.featuredListing.findFirst({ where: { propertyId, endsAt: { gt: now } }, orderBy: { endsAt: "desc" }, select: { endsAt: true } });
  return latest ? latest.endsAt : now;
}

export interface Entitlements {
  subscription: ActiveSubscription | null;
  plan: SubscriptionPlan | null;
  /** null means no limit. */
  maxListings: number | null;
  activeListings: number;
  featuredSlots: number;
  featuredUsed: number;
}

export async function getEntitlements(userId: string, client: Client = db): Promise<Entitlements> {
  const subscription = await activeSubscription(userId, client);
  const plan = subscription?.plan ?? (await freePlan(client));
  const [activeListings, featuredUsed] = await Promise.all([
    client.property.count({ where: { listerId: userId, listingStatus: { in: [...COUNTED_LISTING_STATUSES] } } }),
    subscription ? client.featuredListing.count({ where: { source: `plan:${subscription.id}` } }) : 0,
  ]);
  return {
    subscription,
    plan,
    maxListings: plan?.maxListings ?? null,
    activeListings,
    featuredSlots: subscription?.plan.featuredSlots ?? 0,
    featuredUsed,
  };
}

/**
 * Refuse to put another listing live (submit or resume) when the lister's plan allowance is used up.
 * Listings already live are never taken down when a plan ends; they simply count against the limit.
 */
export async function assertListingCapacity(client: Client, listerId: string, propertyId: string) {
  const e = await getEntitlements(listerId, client);
  if (e.maxListings === null) return;
  const others = await client.property.count({
    where: { listerId, id: { not: propertyId }, listingStatus: { in: [...COUNTED_LISTING_STATUSES] } },
  });
  if (others >= e.maxListings) {
    const planName = e.plan?.name ?? "current";
    throw new AppError(
      "CONFLICT",
      `Your ${planName} plan allows ${e.maxListings} active listing${e.maxListings === 1 ? "" : "s"}. Upgrade your plan in Plans and billing, or pause another listing first.`,
    );
  }
}

/** Feature one of your published listings for 7 days using a featured slot included in your plan. */
export async function spendFeaturedSlot(actorIn: Actor | null, propertyId: string, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  return db.$transaction(async (tx) => {
    const sub = await activeSubscription(actor.id, tx);
    if (!sub || sub.plan.featuredSlots === 0) throw new AppError("CONFLICT", "Your plan does not include featured listings");
    // Serialise slot use per subscription so two quick clicks cannot spend more slots than the plan has.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`featured:${sub.id}`}))`;
    const used = await tx.featuredListing.count({ where: { source: `plan:${sub.id}` } });
    if (used >= sub.plan.featuredSlots) throw new AppError("CONFLICT", "You have used all the featured listings included in your plan for this period");
    const property = await tx.property.findUnique({ where: { id: propertyId }, select: { id: true, reference: true, listerId: true, ownerId: true, listingStatus: true } });
    if (!property || (property.listerId !== actor.id && property.ownerId !== actor.id)) throw notFound("Listing");
    if (property.listingStatus !== "PUBLISHED") throw new AppError("CONFLICT", "Only published listings can be featured");
    const startsAt = await featuredStart(property.id, tx);
    const featured = await tx.featuredListing.create({
      data: { propertyId: property.id, startsAt, endsAt: new Date(startsAt.getTime() + FEATURED_PERIOD_DAYS * 86400_000), source: `plan:${sub.id}` },
    });
    await tx.property.update({ where: { id: property.id }, data: { isFeatured: true } });
    await audit({ actorId: actor.id, action: "listing.feature_from_plan", targetType: "Property", targetId: property.id, metadata: { subscriptionId: sub.id }, ipHash }, tx);
    return { featuredUntil: featured.endsAt.toISOString(), slotsLeft: sub.plan.featuredSlots - used - 1 };
  });
}

/** Sukkot Salone's own payment details for customers paying by transfer, or null when switched off. */
export async function transferDetails(): Promise<{ accountName: string; channels: { channel: ManualPlatformChannel; destination: string }[] } | null> {
  const s = await getSetting("billing.manual");
  if (!s.enabled) return null;
  const channels: { channel: ManualPlatformChannel; destination: string }[] = [];
  if (s.orangeMoneyNumber) channels.push({ channel: "ORANGE_MONEY", destination: s.orangeMoneyNumber });
  if (s.afrimoneyNumber) channels.push({ channel: "AFRIMONEY", destination: s.afrimoneyNumber });
  if (s.bankDetails) channels.push({ channel: "BANK_TRANSFER", destination: s.bankDetails });
  return channels.length ? { accountName: s.accountName, channels } : null;
}
