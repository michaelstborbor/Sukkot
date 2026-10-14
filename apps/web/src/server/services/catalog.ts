import "server-only";
import { cache } from "react";
import { db } from "../db";

/** Reference data used by forms and filters. Cached per request. */
export const getCatalog = cache(async () => {
  const [types, amenities, locations] = await Promise.all([
    db.propertyType.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.amenity.findMany({ where: { isActive: true }, orderBy: [{ group: "asc" }, { name: "asc" }] }),
    db.location.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, level: true, parentId: true } }),
  ]);
  return { types, amenities, locations };
});

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/** Locations with the number of published listings under them (for "Explore locations"). */
export async function locationsWithCounts(level: "DISTRICT" | "CITY") {
  const locs = await db.location.findMany({ where: { level, isActive: true }, orderBy: { sortOrder: "asc" } });
  const counts = await db.$queryRaw<{ id: string; n: bigint }[]>`
    SELECT l.id, COUNT(p.id)::bigint AS n
    FROM locations l
    LEFT JOIN properties p ON p."listingStatus" = 'PUBLISHED' AND l.id = ANY(p."locationPathIds")
    WHERE l.level = ${level}::"LocationLevel"
    GROUP BY l.id`;
  const map = new Map(counts.map((c) => [c.id, Number(c.n)]));
  return locs.map((l) => ({ ...l, count: map.get(l.id) ?? 0 }));
}

/** Full path for a location, e.g. "Aberdeen, Freetown, Western Area Urban". */
export async function locationPath(id: string) {
  const loc = await db.location.findUnique({ where: { id }, select: { pathIds: true } });
  if (!loc) return [];
  const rows = await db.location.findMany({ where: { id: { in: loc.pathIds } } });
  return loc.pathIds.map((pid) => rows.find((r) => r.id === pid)!).filter((r) => r && r.level !== "COUNTRY");
}
