import "server-only";
import { formatMoney, parseSearchParams } from "@sukkot/shared";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";
import { activeSubscription } from "./billing";
import { buildSearchWhere } from "./properties";

/**
 * Tell everyone whose saved search matches a listing that has just gone live. Each person gets one
 * notification (in the app and by email) however many of their searches match. Searches with alerts
 * switched off, the listing's own lister and owner, and suspended accounts are skipped.
 * Returns how many people were told.
 */
export async function alertMatchingSearches(propertyId: string): Promise<number> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, slug: true, title: true, listerId: true, ownerId: true, listingStatus: true, priceMinor: true, currency: true, rentalPeriod: true, location: { select: { name: true } } },
  });
  if (!property || property.listingStatus !== "PUBLISHED") return 0;

  const skip = [property.listerId, property.ownerId].filter((id): id is string => !!id);
  const searches = await db.savedSearch.findMany({
    where: { alertsOn: true, userId: { notIn: skip }, user: { status: "ACTIVE" } },
    select: { id: true, userId: true, name: true, queryString: true },
    orderBy: { createdAt: "asc" },
  });

  const matched = new Map<string, { ids: string[]; names: string[] }>();
  for (const s of searches) {
    const where = await buildSearchWhere(parseSearchParams(new URLSearchParams(s.queryString)));
    if (!where) continue;
    const hit = await db.property.count({ where: { AND: [where, { id: property.id }] } });
    if (!hit) continue;
    const entry = matched.get(s.userId) ?? { ids: [], names: [] };
    entry.ids.push(s.id);
    entry.names.push(s.name);
    matched.set(s.userId, entry);
  }
  if (!matched.size) return 0;

  const price = formatMoney(property.priceMinor, property.currency, { period: property.rentalPeriod });
  await notify(
    [...matched].map(([userId, m]) => ({
      userId,
      type: "search.alert",
      title: `New listing for "${m.names[0]}"${m.names.length > 1 ? ` and ${m.names.length - 1} more` : ""}`,
      body: `${property.title}, ${price}, in ${property.location.name}.`,
      link: `/properties/${property.slug}`,
      email: true,
    })),
  );
  await db.savedSearch.updateMany({ where: { id: { in: [...matched.values()].flatMap((m) => m.ids) } }, data: { lastAlertAt: new Date() } });
  return matched.size;
}

/** How often one person can be sent agents' suggestions, so paid suggestions never become spam. */
const SUGGESTIONS_PER_PERSON_PER_WEEK = 3;
const MAX_SUGGESTION_RECIPIENTS = 300;
const SAME_LISTING_GAP_DAYS = 30;

/**
 * An agent on a paid package suggests one of their published listings to people whose saved
 * searches (with alerts on) cover the listing's area, and its purpose when the search names one.
 * Each package includes a number of suggestions per period (`areaSuggestions`). A listing can be
 * suggested once every 30 days, nobody gets more than three suggestions a week, and a suggestion that
 * reaches nobody is not counted. Returns how many people were told.
 */
export async function suggestListingNearby(actorIn: Actor | null, propertyId: string, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, slug: true, title: true, reference: true, purpose: true, listerId: true, ownerId: true, listingStatus: true, locationPathIds: true, priceMinor: true, currency: true, rentalPeriod: true, location: { select: { name: true } } },
  });
  if (!property || (property.listerId !== actor.id && property.ownerId !== actor.id)) throw notFound("Listing");
  if (property.listingStatus !== "PUBLISHED") throw new AppError("CONFLICT", "Only published listings can be suggested");

  const sub = await activeSubscription(actor.id);
  if (!sub || sub.plan.areaSuggestions === 0) throw new AppError("CONFLICT", "Your plan does not include area suggestions. The agent packages in Plans and billing do.");
  const since = new Date(Date.now() - SAME_LISTING_GAP_DAYS * 86400_000);
  if (await db.listingSuggestion.count({ where: { propertyId: property.id, createdAt: { gte: since } } })) {
    throw new AppError("CONFLICT", `This listing was suggested in the last ${SAME_LISTING_GAP_DAYS} days. Try another listing.`);
  }

  const skip = [property.listerId, property.ownerId].filter((id): id is string => !!id);
  const searches = await db.savedSearch.findMany({
    where: { alertsOn: true, userId: { notIn: skip }, user: { status: "ACTIVE" } },
    select: { userId: true, queryString: true },
    orderBy: { createdAt: "desc" },
  });
  const slugs = new Map<string, string | null>();
  const candidates = new Set<string>();
  for (const s of searches) {
    if (candidates.has(s.userId)) continue;
    const f = parseSearchParams(new URLSearchParams(s.queryString));
    const slug = f.locality ?? f.city ?? f.district ?? f.province;
    if (!slug || (f.purpose && f.purpose !== property.purpose)) continue;
    if (!slugs.has(slug)) slugs.set(slug, (await db.location.findUnique({ where: { slug }, select: { id: true } }))?.id ?? null);
    const locationId = slugs.get(slug);
    if (locationId && property.locationPathIds.includes(locationId)) candidates.add(s.userId);
  }
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const busy = candidates.size
    ? await db.notification.groupBy({ by: ["userId"], where: { userId: { in: [...candidates] }, type: "listing.suggestion", createdAt: { gte: weekAgo } }, _count: { _all: true } })
    : [];
  const full = new Set(busy.filter((b) => b._count._all >= SUGGESTIONS_PER_PERSON_PER_WEEK).map((b) => b.userId));
  const recipients = [...candidates].filter((id) => !full.has(id)).slice(0, MAX_SUGGESTION_RECIPIENTS);
  if (!recipients.length) throw new AppError("CONFLICT", `Nobody with search alerts on is looking in ${property.location.name} right now. Your suggestion was not used.`);

  const price = formatMoney(property.priceMinor, property.currency, { period: property.rentalPeriod });
  return db.$transaction(async (tx) => {
    // Serialise per subscription so two quick clicks cannot send more suggestions than the plan has.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`suggest:${sub.id}`}))`;
    const used = await tx.listingSuggestion.count({ where: { subscriptionId: sub.id } });
    if (used >= sub.plan.areaSuggestions) throw new AppError("CONFLICT", "You have used all the area suggestions in your plan for this period");
    await tx.listingSuggestion.create({ data: { propertyId: property.id, senderId: actor.id, subscriptionId: sub.id, recipients: recipients.length } });
    await notify(
      recipients.map((userId) => ({
        userId,
        type: "listing.suggestion",
        title: `Suggested for you in ${property.location.name}`,
        body: `${property.title}, ${price}. Suggested by an agent because you search in this area. Turn off alerts on your saved searches to stop these.`,
        link: `/properties/${property.slug}`,
        email: true,
      })),
      tx,
    );
    await audit({ actorId: actor.id, action: "listing.suggest_nearby", targetType: "Property", targetId: property.id, metadata: { recipients: recipients.length, subscriptionId: sub.id }, ipHash }, tx);
    return { recipients: recipients.length, left: sub.plan.areaSuggestions - used - 1 };
  });
}
