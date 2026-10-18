import "server-only";
import { formatMoney, parseSearchParams } from "@sukkot/shared";
import { db } from "../db";
import { notify } from "../notify";
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
