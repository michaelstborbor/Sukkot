/**
 * Add Sierra Leone's cities, towns and their areas or sections from OpenStreetMap.
 *
 *   pnpm --filter @sukkot/web locations:import-osm                 # report only, changes nothing
 *   pnpm --filter @sukkot/web locations:import-osm -- --apply      # write to the database
 *
 * Options:
 *   --file <path>          read a saved Overpass JSON export instead of calling overpass-api.de
 *   --save <path>          keep a copy of what Overpass returned
 *   --district-level <n>   OSM admin_level of Sierra Leone's districts (default 5)
 *   --include-villages     also import villages as towns (many thousands of places)
 *   --overpass-url <url>   a different Overpass server
 *
 * Safe to run again: places are matched first by OSM id, then by name under the same parent. It
 * never deletes, hides or renames a location, and only fills coordinates that are missing.
 * Data © OpenStreetMap contributors, ODbL. The site shows that attribution once any place is linked.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient, type Location } from "@prisma/client";
import { slugify } from "@sukkot/shared";
import { matchDistricts, OVERPASS_URL, overpassQuery, parseOverpass, planDistricts, type OsmPlace } from "../src/server/osm-places";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : (process.argv[i + 1] ?? "");
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function fetchOverpass(url: string, query: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(330_000),
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "sukkot-salone-location-import" },
    body: new URLSearchParams({ data: query }),
  }).catch((e: unknown) => {
    throw new Error(`Could not reach ${url} (${e instanceof Error ? e.message : e}). If this network blocks it, save the export elsewhere and pass --file.`);
  });
  if (!res.ok) throw new Error(`Overpass answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  const apply = flag("apply");
  const level = Number(arg("district-level") ?? 5);
  const query = overpassQuery(level, flag("include-villages"));
  const file = arg("file");
  const raw = file ? JSON.parse(readFileSync(file, "utf8")) : await fetchOverpass(arg("overpass-url") ?? OVERPASS_URL, query);
  const save = arg("save");
  if (save) writeFileSync(save, JSON.stringify(raw));

  const planned = planDistricts(parseOverpass(raw));
  if (planned.length === 0) {
    console.error(`OpenStreetMap returned no districts at admin_level ${level}. Try --district-level with another value.`);
    process.exitCode = 1;
    return;
  }

  const db = new PrismaClient();
  const stats = { citiesAndTownsAdded: 0, citiesAndTownsLinked: 0, areasAdded: 0, areasLinked: 0 };
  try {
    const ourDistricts = await db.location.findMany({ where: { level: "DISTRICT" } });
    const { matched, unmatched } = matchDistricts(planned, ourDistricts);

    async function uniqueSlug(name: string, parent: Location) {
      for (const candidate of [slugify(name), slugify(`${name}-${parent.name}`), slugify(`${name}-${parent.name}-${parent.id.slice(-6)}`)]) {
        if (!(await db.location.findUnique({ where: { slug: candidate } }))) return candidate;
      }
      return slugify(`${name}-${Date.now()}`);
    }

    /** Find the place by OSM id, then by name under the parent; link or add it. */
    async function upsert(p: OsmPlace, parent: Location, level: "CITY" | "LOCALITY", isCity: boolean) {
      const existing =
        (await db.location.findUnique({ where: { osmId: p.osmId } })) ??
        (await db.location.findFirst({ where: { parentId: parent.id, level, name: { equals: p.name, mode: "insensitive" } } }));
      if (existing) {
        const isNewLink = existing.osmId !== p.osmId;
        if (apply && (isNewLink || (isCity && !existing.isCity) || existing.latitude === null)) {
          await db.location.update({
            where: { id: existing.id },
            data: {
              osmId: existing.osmId ?? p.osmId,
              isCity: existing.isCity || isCity,
              ...(existing.latitude === null || existing.longitude === null ? { latitude: p.lat, longitude: p.lon } : {}),
            },
          });
        }
        if (isNewLink) stats[level === "CITY" ? "citiesAndTownsLinked" : "areasLinked"]++;
        return existing;
      }
      stats[level === "CITY" ? "citiesAndTownsAdded" : "areasAdded"]++;
      if (!apply) return null;
      const created = await db.location.create({
        data: { name: p.name, slug: await uniqueSlug(p.name, parent), level, isCity, osmId: p.osmId, parentId: parent.id, pathIds: [], latitude: p.lat, longitude: p.lon, sortOrder: 1000 },
      });
      return db.location.update({ where: { id: created.id }, data: { pathIds: [...parent.pathIds, created.id] } });
    }

    for (const { osm, ours } of matched) {
      for (const s of osm.settlements) {
        const place = await upsert(s, ours, "CITY", s.isCity);
        for (const a of s.areas) {
          if (place) await upsert(a, place, "LOCALITY", false);
          else stats.areasAdded++;
        }
      }
    }

    console.log(apply ? "Imported from OpenStreetMap:" : "Dry run (nothing written). With --apply this would make these changes:");
    console.log(`  districts matched: ${matched.length} of ${planned.length}`);
    console.log(`  cities and towns: ${stats.citiesAndTownsAdded} new, ${stats.citiesAndTownsLinked} existing linked to OpenStreetMap`);
    console.log(`  areas and sections: ${stats.areasAdded} new, ${stats.areasLinked} existing linked to OpenStreetMap`);
    if (unmatched.length) console.log(`  OpenStreetMap districts with no match here (skipped): ${unmatched.map((u) => u.name).join(", ")}`);
    const loose = matched.flatMap((m) => m.osm.unassignedAreas.map((a) => `${a.name} (${m.ours.name})`));
    if (loose.length) console.log(`  areas too far from any city or town (skipped): ${loose.length}, e.g. ${loose.slice(0, 10).join(", ")}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
