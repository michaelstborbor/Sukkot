/**
 * Turning an OpenStreetMap (Overpass) export of Sierra Leone's places into our location hierarchy:
 * district → city or town → area or section. Pure functions, used by scripts/import-osm-locations.ts.
 * Data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).
 */

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** OSM place values we import, and what they become here. */
export const SETTLEMENT_PLACES = ["city", "town"] as const;
export const AREA_PLACES = ["suburb", "quarter", "neighbourhood"] as const;

/** How far an area may sit from the centre of the city or town it is filed under. */
export const AREA_RADIUS_KM = { city: 15, town: 5 } as const;

/**
 * Districts are administrative boundaries at `districtAdminLevel` inside Sierra Leone. For each
 * district the query prints the boundary's tags, then the city, town and area nodes inside it.
 */
export function overpassQuery(districtAdminLevel = 5, includeVillages = false) {
  const places = [...SETTLEMENT_PLACES, ...(includeVillages ? ["village"] : []), ...AREA_PLACES].join("|");
  return `[out:json][timeout:300];
area["ISO3166-1"="SL"][admin_level=2]->.sl;
rel(area.sl)[boundary=administrative][admin_level=${districtAdminLevel}];
foreach->.d(
  .d out tags;
  .d map_to_area->.a;
  node(area.a)[place~"^(${places})$"][name];
  out;
);`;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export interface OsmPlace {
  osmId: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
}

export interface OsmDistrict {
  osmId: string;
  name: string;
  places: OsmPlace[];
}

const placeName = (tags: Record<string, string>) => (tags["name:en"] ?? tags.name ?? "").trim();

/** "Bo District" and "bo" match; accents and punctuation are ignored. */
export function normalizeName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Group the flat Overpass output into districts with the places that follow each one. */
export function parseOverpass(json: { elements?: OverpassElement[] }): OsmDistrict[] {
  const districts: OsmDistrict[] = [];
  const seen = new Set<string>();
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    if (el.type === "relation") {
      const name = placeName(tags);
      if (name) districts.push({ osmId: `relation/${el.id}`, name, places: [] });
      continue;
    }
    const current = districts.at(-1);
    const name = placeName(tags);
    if (el.type !== "node" || !current || !name || !tags.place || el.lat === undefined || el.lon === undefined) continue;
    const osmId = `node/${el.id}`;
    // A place on a shared border can fall inside two districts; keep it in the first.
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    current.places.push({ osmId, name, place: tags.place, lat: el.lat, lon: el.lon });
  }
  return districts;
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface PlannedSettlement extends OsmPlace {
  isCity: boolean;
  areas: OsmPlace[];
}

export interface PlannedDistrict {
  osmId: string;
  name: string;
  settlements: PlannedSettlement[];
  /** Areas with no city or town close enough to file them under. Reported, not imported. */
  unassignedAreas: OsmPlace[];
}

/**
 * Within each district, cities and towns (and villages, when asked for) become CITY-level places and
 * each area goes under the nearest of them within reach (15 km of a city, 5 km of a town).
 */
export function planDistricts(districts: OsmDistrict[]): PlannedDistrict[] {
  return districts.map((d) => {
    const settlements: PlannedSettlement[] = d.places
      .filter((p) => !(AREA_PLACES as readonly string[]).includes(p.place))
      .map((p) => ({ ...p, isCity: p.place === "city", areas: [] }));
    const unassignedAreas: OsmPlace[] = [];
    for (const area of d.places.filter((p) => (AREA_PLACES as readonly string[]).includes(p.place))) {
      let best: { s: PlannedSettlement; km: number } | null = null;
      for (const s of settlements) {
        const km = distanceKm(s, area);
        if (km <= (s.isCity ? AREA_RADIUS_KM.city : AREA_RADIUS_KM.town) && (!best || km < best.km)) best = { s, km };
      }
      if (best) best.s.areas.push(area);
      else unassignedAreas.push(area);
    }
    return { osmId: d.osmId, name: d.name, settlements, unassignedAreas };
  });
}

/** Pair OSM districts with ours by name. OSM districts with no match are reported and skipped. */
export function matchDistricts<T extends { name: string }>(planned: PlannedDistrict[], ours: T[]) {
  const byName = new Map(ours.map((o) => [normalizeName(o.name), o]));
  const matched: { osm: PlannedDistrict; ours: T }[] = [];
  const unmatched: PlannedDistrict[] = [];
  for (const p of planned) {
    const o = byName.get(normalizeName(p.name));
    if (o) matched.push({ osm: p, ours: o });
    else unmatched.push(p);
  }
  return { matched, unmatched };
}
