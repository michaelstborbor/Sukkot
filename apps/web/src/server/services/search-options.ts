import "server-only";
import { PROPERTY_CATEGORY_LABELS } from "@sukkot/shared";
import { getCatalog } from "./catalog";

/** Options for search dropdowns, derived from the live catalogue (never hardcoded). */
export async function searchOptions() {
  const { types, locations, amenities, usesOsmData } = await getCatalog();
  const byId = new Map(locations.map((l) => [l.id, l]));
  const districts = locations.filter((l) => l.level === "DISTRICT").sort((a, b) => a.name.localeCompare(b.name));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const cities = locations.filter((l) => l.level === "CITY").sort(byName);
  const localities = locations.filter((l) => l.level === "LOCALITY").sort(byName);
  return {
    types: types.map((t) => ({ value: t.slug, label: t.name, group: PROPERTY_CATEGORY_LABELS[t.category] })),
    locations: [
      ...cities.map((c) => ({ value: `city:${c.slug}`, label: c.name, group: c.isCity ? "Cities" : "Towns" })),
      ...districts.map((d) => ({ value: `district:${d.slug}`, label: `${d.name} District`, group: "Districts" })),
    ],
    districts: districts.map((d) => ({ value: d.slug, label: d.name })),
    cities: cities.map((c) => ({ value: c.slug, label: c.name, parent: byId.get(c.parentId ?? "")?.slug ?? "", group: c.isCity ? "Cities" : "Towns" })),
    localities: localities.map((l) => ({ value: l.slug, label: l.name, parent: byId.get(l.parentId ?? "")?.slug ?? "" })),
    amenities: amenities.map((a) => ({ value: a.slug, label: a.name, group: a.group })),
    osmAttribution: usesOsmData,
  };
}
