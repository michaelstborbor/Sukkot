/**
 * Starter data for the location hierarchy: province → district → city or town → area or section.
 * At runtime locations live in the `locations` table; administrators maintain them, and
 * `pnpm --filter @sukkot/web locations:import-osm` adds places from OpenStreetMap. Nothing in the app
 * hardcodes this list.
 *
 * Administrative units follow the 2017 reorganisation (5 regions, 16 districts). Entries are only
 * ever appended, never reordered or renamed, so existing databases keep their slugs.
 */
export interface TownSeed {
  name: string;
  /** Cities (city councils) are shown apart from towns in the filters. */
  city?: boolean;
  localities?: string[];
}

export interface ProvinceSeed {
  name: string;
  districts: { name: string; towns: TownSeed[] }[];
}

export const SIERRA_LEONE_LOCATIONS: ProvinceSeed[] = [
  {
    name: "Western Area",
    districts: [
      {
        name: "Western Area Urban",
        towns: [
          {
            name: "Freetown",
            city: true,
            localities: [
              "Aberdeen", "Lumley", "Hill Station", "Wilberforce", "Murray Town", "Congo Cross", "Spur Road", "Juba",
              "Goderich", "Hamilton", "Kissy", "Wellington", "Brookfields", "Tengbeh Town", "Signal Hill", "Regent Road",
              "Central Freetown", "Kingtom", "Calaba Town", "Allen Town",
              "Cockle Bay", "Cline Town", "Fourah Bay", "Foulah Town", "Kroo Town", "Ascension Town", "Tower Hill",
              "Wilkinson Road", "New England", "Hill Cot Road", "Dworzark", "Ferry Junction", "Grassfield",
              "Thunder Hill", "Sorie Town", "Ginger Hall", "Mount Aureol", "Kingharman Road", "Pademba Road",
              "Mountain Cut", "Portee", "Rokupa", "Mabella",
            ],
          },
        ],
      },
      {
        name: "Western Area Rural",
        towns: [
          { name: "Waterloo", localities: ["Lumpa", "Benguema", "Campbell Town", "Jui", "Hastings"] },
          { name: "Tokeh", localities: ["Tokeh Beach", "Sussex", "York", "Kent"] },
          { name: "Regent", localities: ["Regent Village", "Bathurst", "Charlotte", "Gloucester"] },
          { name: "Grafton" },
          { name: "Lakka" },
          { name: "Newton" },
          { name: "Songo" },
          { name: "Tombo" },
        ],
      },
    ],
  },
  {
    name: "Northern Province",
    districts: [
      { name: "Bombali", towns: [{ name: "Makeni", city: true, localities: ["Azzolini Highway", "Teko Barracks", "Mabanta Road", "Rogbaneh", "Masuba", "Teko Road"] }, { name: "Kamabai" }, { name: "Binkolo" }, { name: "Kalangba" }, { name: "Karina" }] },
      { name: "Falaba", towns: [{ name: "Bendugu" }, { name: "Falaba" }, { name: "Musaia" }, { name: "Sinkunia" }] },
      { name: "Koinadugu", towns: [{ name: "Kabala", localities: ["Wara Wara Hills"] }, { name: "Fadugu" }] },
      { name: "Tonkolili", towns: [{ name: "Magburaka" }, { name: "Mile 91" }, { name: "Bumbuna" }, { name: "Matotoka" }, { name: "Yele" }, { name: "Masingbi" }] },
    ],
  },
  {
    name: "North West Province",
    districts: [
      { name: "Port Loko", towns: [{ name: "Port Loko" }, { name: "Lungi", localities: ["Lungi Airport Area", "Tagrin"] }, { name: "Lunsar" }, { name: "Pepel" }, { name: "Masiaka" }] },
      { name: "Kambia", towns: [{ name: "Kambia" }, { name: "Rokupr" }, { name: "Gbalamuya" }] },
      { name: "Karene", towns: [{ name: "Kamakwie" }, { name: "Batkanu" }, { name: "Karene" }] },
    ],
  },
  {
    name: "Southern Province",
    districts: [
      { name: "Bo", towns: [{ name: "Bo", city: true, localities: ["New London", "Bo Town Centre", "Kindia", "Reservation", "Tikonko Road", "Moriba Town", "Shellmingo"] }, { name: "Baoma" }, { name: "Gerihun" }, { name: "Koribondo" }, { name: "Sumbuya" }, { name: "Tikonko" }] },
      { name: "Bonthe", towns: [{ name: "Bonthe" }, { name: "Mattru Jong" }] },
      { name: "Moyamba", towns: [{ name: "Moyamba" }, { name: "Shenge" }, { name: "Rotifunk" }, { name: "Taiama" }, { name: "Moyamba Junction" }] },
      { name: "Pujehun", towns: [{ name: "Pujehun" }, { name: "Zimmi" }, { name: "Potoru" }] },
    ],
  },
  {
    name: "Eastern Province",
    districts: [
      { name: "Kenema", towns: [{ name: "Kenema", city: true, localities: ["Hangha Road", "Blama Road", "Nongowa", "Kenema Town Centre", "Nyandeyama", "Kpayama", "Lambayama"] }, { name: "Blama" }, { name: "Tongo Field" }, { name: "Panguma" }] },
      { name: "Kono", towns: [{ name: "Koidu", city: true, localities: ["Koidu Town Centre", "Tankoro", "Gbense"] }, { name: "Yengema" }, { name: "Tombodu" }, { name: "Motema" }] },
      { name: "Kailahun", towns: [{ name: "Kailahun" }, { name: "Segbwema" }, { name: "Pendembu" }, { name: "Daru" }, { name: "Buedu" }, { name: "Koindu" }] },
    ],
  },
];

/** Entries from earlier starter data that were wrong. The seed switches them off (never deletes). */
export const RETIRED_LOCATIONS: { district: string; town: string }[] = [
  // Kabala is the headquarter town of Koinadugu, not Falaba.
  { district: "Falaba", town: "Kabala" },
];

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const LOCATION_LEVELS = ["COUNTRY", "PROVINCE", "DISTRICT", "CITY", "LOCALITY"] as const;
export type LocationLevel = (typeof LOCATION_LEVELS)[number];
