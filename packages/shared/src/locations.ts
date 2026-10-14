/**
 * Seed data for the location hierarchy (province → district → city/town → locality).
 * This is only the initial dataset: at runtime locations live in the `locations` table and
 * administrators maintain them, so nothing in the app hardcodes this list.
 *
 * Administrative units follow the 2017 reorganisation (5 regions, 16 districts).
 */
export interface LocationSeed {
  name: string;
  children?: LocationSeed[];
}

export interface ProvinceSeed {
  name: string;
  districts: { name: string; towns: { name: string; localities?: string[] }[] }[];
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
            localities: [
              "Aberdeen",
              "Lumley",
              "Hill Station",
              "Wilberforce",
              "Murray Town",
              "Congo Cross",
              "Spur Road",
              "Juba",
              "Goderich",
              "Hamilton",
              "Kissy",
              "Wellington",
              "Brookfields",
              "Tengbeh Town",
              "Signal Hill",
              "Regent Road",
              "Central Freetown",
              "Kingtom",
              "Calaba Town",
              "Allen Town",
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
        ],
      },
    ],
  },
  {
    name: "Northern Province",
    districts: [
      { name: "Bombali", towns: [{ name: "Makeni", localities: ["Azzolini Highway", "Teko Barracks", "Mabanta Road", "Rogbaneh"] }, { name: "Kamabai" }] },
      { name: "Falaba", towns: [{ name: "Bendugu" }, { name: "Kabala" }] },
      { name: "Koinadugu", towns: [{ name: "Kabala", localities: ["Wara Wara Hills"] }] },
      { name: "Tonkolili", towns: [{ name: "Magburaka" }, { name: "Mile 91" }, { name: "Bumbuna" }] },
    ],
  },
  {
    name: "North West Province",
    districts: [
      { name: "Port Loko", towns: [{ name: "Port Loko" }, { name: "Lungi", localities: ["Lungi Airport Area", "Tagrin"] }, { name: "Lunsar" }] },
      { name: "Kambia", towns: [{ name: "Kambia" }, { name: "Rokupr" }] },
      { name: "Karene", towns: [{ name: "Kamakwie" }, { name: "Batkanu" }] },
    ],
  },
  {
    name: "Southern Province",
    districts: [
      { name: "Bo", towns: [{ name: "Bo", localities: ["New London", "Bo Town Centre", "Kindia", "Reservation", "Tikonko Road"] }] },
      { name: "Bonthe", towns: [{ name: "Bonthe" }, { name: "Mattru Jong" }] },
      { name: "Moyamba", towns: [{ name: "Moyamba" }, { name: "Shenge" }] },
      { name: "Pujehun", towns: [{ name: "Pujehun" }] },
    ],
  },
  {
    name: "Eastern Province",
    districts: [
      { name: "Kenema", towns: [{ name: "Kenema", localities: ["Hangha Road", "Blama Road", "Nongowa", "Kenema Town Centre"] }] },
      { name: "Kono", towns: [{ name: "Koidu", localities: ["Koidu Town Centre", "Tankoro", "Gbense"] }, { name: "Yengema" }] },
      { name: "Kailahun", towns: [{ name: "Kailahun" }, { name: "Segbwema" }, { name: "Pendembu" }] },
    ],
  },
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
