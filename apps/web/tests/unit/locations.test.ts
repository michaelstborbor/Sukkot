import { describe, expect, it } from "vitest";
import { RETIRED_LOCATIONS, SIERRA_LEONE_LOCATIONS, validatePropertyForCategory, type PropertyParsed } from "@sukkot/shared";
import { matchDistricts, normalizeName, overpassQuery, parseOverpass, planDistricts } from "@/server/osm-places";

const base = { purpose: "SALE", plotSize: 1, plotUnit: "TOWN_LOT" } as unknown as PropertyParsed;

describe("property types", () => {
  it("asks what the property is when the type is Other", () => {
    expect(validatePropertyForCategory(base, "OTHER", "other").map((e) => e.path)).toContain("propertyTypeOther");
    expect(validatePropertyForCategory({ ...base, propertyTypeOther: "Fuel station" }, "OTHER", "other")).toEqual([]);
  });

  it("lets land with a property on it have bedrooms, but not empty land", () => {
    const withRooms = { ...base, bedrooms: 3 };
    expect(validatePropertyForCategory(withRooms, "LAND", "land-with-property")).toEqual([]);
    expect(validatePropertyForCategory(withRooms, "LAND", "empty-land").map((e) => e.path)).toContain("bedrooms");
  });
});

describe("starter locations", () => {
  const districts = SIERRA_LEONE_LOCATIONS.flatMap((p) => p.districts);

  it("covers all 16 districts, each with at least one town, and no place listed twice", () => {
    expect(districts).toHaveLength(16);
    for (const d of districts) {
      expect(d.towns.length, d.name).toBeGreaterThan(0);
      const names = d.towns.map((t) => t.name.toLowerCase());
      expect(new Set(names).size, d.name).toBe(names.length);
      for (const t of d.towns) {
        const areas = (t.localities ?? []).map((l) => l.toLowerCase());
        expect(new Set(areas).size, t.name).toBe(areas.length);
      }
    }
  });

  it("marks the five city councils as cities", () => {
    const cities = districts.flatMap((d) => d.towns.filter((t) => t.city).map((t) => t.name)).sort();
    expect(cities).toEqual(["Bo", "Freetown", "Kenema", "Koidu", "Makeni"]);
  });

  it("no longer lists retired places", () => {
    for (const r of RETIRED_LOCATIONS) {
      const d = districts.find((x) => x.name === r.district)!;
      expect(d.towns.some((t) => t.name === r.town)).toBe(false);
    }
  });
});

// A small, hand-made Overpass answer in the shape the import query produces.
const fixture = {
  elements: [
    { type: "relation", id: 1, tags: { name: "Bo District", boundary: "administrative" } },
    { type: "node", id: 10, lat: 7.9647, lon: -11.7383, tags: { place: "city", name: "Bo" } },
    { type: "node", id: 11, lat: 7.97, lon: -11.74, tags: { place: "suburb", name: "New London" } },
    { type: "node", id: 12, lat: 8.2, lon: -11.4, tags: { place: "neighbourhood", name: "Far Away" } },
    { type: "node", id: 13, lat: 7.75, lon: -11.95, tags: { place: "town", name: "Sumbuya" } },
    { type: "node", id: 14, lat: 7.751, lon: -11.951, tags: { place: "quarter", name: "Sumbuya Central" } },
    { type: "node", id: 15, lat: 7.8, lon: -11.8, tags: { place: "town" } },
    { type: "relation", id: 2, tags: { name: "Kenema", "name:en": "Kenema District" } },
    { type: "node", id: 13, lat: 7.75, lon: -11.95, tags: { place: "town", name: "Sumbuya" } },
    { type: "node", id: 20, lat: 7.8767, lon: -11.19, tags: { place: "city", name: "Kenema" } },
    { type: "relation", id: 3, tags: { name: "Atlantis" } },
  ],
} as Parameters<typeof parseOverpass>[0];

describe("OpenStreetMap import", () => {
  it("asks Overpass for districts at the given admin level and their places", () => {
    expect(overpassQuery(6)).toContain("[admin_level=6]");
    expect(overpassQuery()).not.toContain("village");
    expect(overpassQuery(5, true)).toContain("village");
  });

  it("groups places under the district they follow, skipping nameless and repeated nodes", () => {
    const parsed = parseOverpass(fixture);
    expect(parsed.map((d) => d.name)).toEqual(["Bo District", "Kenema District", "Atlantis"]);
    expect(parsed[0]!.places.map((p) => p.osmId)).toEqual(["node/10", "node/11", "node/12", "node/13", "node/14"]);
    expect(parsed[1]!.places.map((p) => p.name)).toEqual(["Kenema"]);
  });

  it("files each area under the nearest city or town in reach, and reports the rest", () => {
    const [bo] = planDistricts(parseOverpass(fixture));
    const city = bo!.settlements.find((s) => s.name === "Bo")!;
    expect(city.isCity).toBe(true);
    expect(city.areas.map((a) => a.name)).toEqual(["New London"]);
    expect(bo!.settlements.find((s) => s.name === "Sumbuya")!.areas.map((a) => a.name)).toEqual(["Sumbuya Central"]);
    expect(bo!.unassignedAreas.map((a) => a.name)).toEqual(["Far Away"]);
  });

  it("matches districts by name and skips ones we do not have", () => {
    expect(normalizeName("Western Area Urban District")).toBe("western area urban");
    const { matched, unmatched } = matchDistricts(planDistricts(parseOverpass(fixture)), [{ name: "Bo" }, { name: "Kenema" }]);
    expect(matched.map((m) => m.ours.name)).toEqual(["Bo", "Kenema"]);
    expect(unmatched.map((u) => u.name)).toEqual(["Atlantis"]);
  });
});
