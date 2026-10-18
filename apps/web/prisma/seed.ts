/**
 * Seed reference data (locations, categories, amenities, plans, settings) and — outside production —
 * clearly-labelled demonstration accounts and listings. All people, agencies, prices, phone numbers
 * and reference numbers below are fictional.
 *
 *   pnpm db:seed
 */
import { Prisma, PrismaClient, type AreaUnit, type Electricity, type Furnishing, type ListingPurpose, type ListerCapacity, type PropertyCategory, type RentalPeriod, type WaterSupply } from "@prisma/client";
import bcrypt from "bcryptjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { RETIRED_LOCATIONS, SIERRA_LEONE_LOCATIONS, slugify, DUE_DILIGENCE_TEMPLATE } from "@sukkot/shared";
import { demoSvg, type DemoKind } from "./demo-art";

const db = new PrismaClient();
const isProd = process.env.NODE_ENV === "production";
const withDemo = !isProd || process.env.SEED_ALLOW_DEMO === "true";
export const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "SukkotDemo2026";

const COORDS: Record<string, [number, number]> = {
  Freetown: [8.4844, -13.2344],
  Waterloo: [8.3389, -13.0709],
  Tokeh: [8.3667, -13.2],
  Regent: [8.43, -13.21],
  Grafton: [8.405, -13.155],
  Bo: [7.9647, -11.7383],
  Kenema: [7.8767, -11.1875],
  Koidu: [8.6439, -10.9714],
  Yengema: [8.7167, -11.1667],
  Makeni: [8.8833, -12.05],
  Kamabai: [9.1333, -11.95],
  "Port Loko": [8.7667, -12.7833],
  Lungi: [8.6167, -13.2],
  Lunsar: [8.6833, -12.5333],
  Kabala: [9.5889, -11.5528],
  Bendugu: [9.75, -11.33],
  Magburaka: [8.7231, -11.9486],
  "Mile 91": [8.4667, -12.2167],
  Bumbuna: [9.05, -11.7333],
  Kambia: [9.125, -12.9167],
  Rokupr: [9.0167, -12.95],
  Kamakwie: [9.4967, -12.2406],
  Batkanu: [9.0667, -12.4167],
  Bonthe: [7.5264, -12.505],
  "Mattru Jong": [7.6167, -12.1833],
  Moyamba: [8.1592, -12.4331],
  Shenge: [7.9167, -12.95],
  Pujehun: [7.3581, -11.7208],
  Kailahun: [8.2789, -10.5739],
  Segbwema: [7.9953, -10.9506],
  Pendembu: [8.1, -10.7],
};

async function seedLocations() {
  const country = await db.location.upsert({
    where: { slug: "sierra-leone" },
    create: { name: "Sierra Leone", slug: "sierra-leone", level: "COUNTRY", pathIds: [] },
    update: {},
  });
  if (!country.pathIds.length) await db.location.update({ where: { id: country.id }, data: { pathIds: [country.id] } });
  const used = new Set<string>();
  const uniqueSlug = (name: string, parent: string) => {
    let s = slugify(name);
    if (used.has(s)) s = slugify(`${name}-${parent}`);
    used.add(s);
    return s;
  };
  let order = 0;
  for (const prov of SIERRA_LEONE_LOCATIONS) {
    const p = await upsertLoc(prov.name, uniqueSlug(prov.name, ""), "PROVINCE", country.id, [country.id], order++);
    for (const d of prov.districts) {
      const dist = await upsertLoc(d.name, uniqueSlug(d.name, prov.name), "DISTRICT", p.id, p.pathIds, order++);
      for (const t of d.towns) {
        const c = COORDS[t.name];
        const town = await upsertLoc(t.name, uniqueSlug(t.name, "town"), "CITY", dist.id, dist.pathIds, order++, c, t.city === true);
        for (const l of t.localities ?? []) {
          await upsertLoc(l, uniqueSlug(l, t.name), "LOCALITY", town.id, town.pathIds, order++, c);
        }
      }
    }
  }
  for (const r of RETIRED_LOCATIONS) {
    const town = await db.location.findFirst({ where: { name: r.town, level: "CITY", isActive: true, parent: { name: r.district, level: "DISTRICT" } }, include: { _count: { select: { properties: true } } } });
    if (town && town._count.properties === 0) await db.location.update({ where: { id: town.id }, data: { isActive: false } });
  }
}

/**
 * Find a place by name under the same parent (so a changed slug never duplicates it), otherwise
 * create it. Existing rows are left as they are, except that a place the seed marks as a city is
 * flagged as one.
 */
async function upsertLoc(name: string, slug: string, level: "PROVINCE" | "DISTRICT" | "CITY" | "LOCALITY", parentId: string, parentPath: string[], sortOrder: number, coords?: [number, number], isCity = false) {
  const existing =
    (await db.location.findFirst({ where: { parentId, level, name: { equals: name, mode: "insensitive" } } })) ??
    (await db.location.findFirst({ where: { slug, parentId } }));
  if (existing) {
    if (isCity && !existing.isCity) return db.location.update({ where: { id: existing.id }, data: { isCity: true } });
    return existing;
  }
  let finalSlug = slug;
  if (await db.location.findUnique({ where: { slug } })) finalSlug = slugify(`${name}-${parentPath.length}-${parentId.slice(-6)}`);
  const created = await db.location.create({
    data: { name, slug: finalSlug, level, parentId, pathIds: [], sortOrder, latitude: coords?.[0], longitude: coords?.[1], isCity },
  });
  return db.location.update({ where: { id: created.id }, data: { pathIds: [...parentPath, created.id] } });
}

// Must match the migration that introduced this list (20261015010100_new_property_types).
const TYPES: { name: string; category: PropertyCategory; description: string }[] = [
  { name: "Empty land", category: "LAND", description: "Plots and land with no building on it" },
  { name: "Land with property", category: "LAND", description: "Land sold or leased with a building on it" },
  { name: "House", category: "HOUSE", description: "Houses, bungalows and duplexes" },
  { name: "Apartment", category: "APARTMENT", description: "Flats and self-contained rooms" },
  { name: "Shop", category: "COMMERCIAL", description: "Retail units and stores" },
  { name: "Office", category: "COMMERCIAL", description: "Offices and co-working space" },
  { name: "Short stay", category: "SHORT_STAY", description: "Furnished places to stay by the night or week" },
  { name: "Commercial", category: "COMMERCIAL", description: "Warehouses, workshops and other business premises" },
  { name: "Hotel", category: "COMMERCIAL", description: "Hotels for sale, lease or rent" },
  { name: "Guesthouse", category: "COMMERCIAL", description: "Guesthouses for sale, lease or rent" },
  { name: "Motel", category: "COMMERCIAL", description: "Motels for sale, lease or rent" },
  { name: "Other", category: "OTHER", description: "Anything else; the lister says what it is" },
];

const AMENITIES: [string, string][] = [
  ["Backup generator", "Power"],
  ["Solar power", "Power"],
  ["Inverter", "Power"],
  ["Water tank", "Water"],
  ["Borehole", "Water"],
  ["Security guard", "Security"],
  ["Perimeter wall", "Security"],
  ["Electric fence", "Security"],
  ["CCTV", "Security"],
  ["Gated compound", "Security"],
  ["Air conditioning", "Comfort"],
  ["Ceiling fans", "Comfort"],
  ["Fitted kitchen", "Comfort"],
  ["Balcony", "Comfort"],
  ["Sea view", "Views"],
  ["Mountain view", "Views"],
  ["Garden", "Outdoor"],
  ["Swimming pool", "Outdoor"],
  ["Boys' quarters", "Outdoor"],
  ["Parking", "Access"],
  ["Tarred road access", "Access"],
  ["Wheelchair accessible", "Access"],
  ["Internet ready", "Services"],
  ["Cleaning service", "Services"],
  ["Near school", "Neighbourhood"],
  ["Near market", "Neighbourhood"],
];

async function seedCatalog() {
  for (const [i, t] of TYPES.entries()) {
    await db.propertyType.upsert({ where: { slug: slugify(t.name) }, create: { ...t, slug: slugify(t.name), sortOrder: i }, update: { category: t.category } });
  }
  for (const [name, group] of AMENITIES) {
    await db.amenity.upsert({ where: { slug: slugify(name) }, create: { name, slug: slugify(name), group }, update: {} });
  }
  // Starting prices in new Leones; administrators change them in Admin → Plans. Features list only
  // what the platform actually enforces or provides.
  const plans = [
    { code: "landlord-free", name: "Landlord Basic", audience: "LANDLORD", description: "List up to 3 properties for free.", priceMinor: 0n, maxListings: 3, featuredSlots: 0, features: ["Up to 3 active listings", "Enquiries, messaging and inspection booking", "Tenancy and rent records"], sortOrder: 0 },
    { code: "landlord-pro", name: "Landlord Pro", audience: "LANDLORD", description: "For landlords managing several properties.", priceMinor: 300n * 100n, maxListings: 25, featuredSlots: 1, features: ["Up to 25 active listings", "1 featured listing (7 days) every 30 days", "Everything in Landlord Basic"], sortOrder: 1 },
    { code: "agent-pro", name: "Agent Pro", audience: "AGENT", description: "For agents and small agencies.", priceMinor: 900n * 100n, maxListings: 100, featuredSlots: 3, features: ["Up to 100 active listings", "3 featured listings (7 days each) every 30 days", "Everything in Landlord Basic"], sortOrder: 2 },
  ];
  // Earlier seeds used placeholder prices a hundred times too high. Replace them only where an
  // administrator has not changed the price since.
  const OLD_PLACEHOLDER_PRICES: Record<string, bigint> = { "landlord-pro": 25_000n * 100n, "agent-pro": 60_000n * 100n };
  for (const p of plans) {
    const existing = await db.subscriptionPlan.findUnique({ where: { code: p.code } });
    if (!existing) await db.subscriptionPlan.create({ data: { ...p, currency: "SLE", periodDays: 30, isActive: true } });
    else if (existing.priceMinor === OLD_PLACEHOLDER_PRICES[p.code]) {
      await db.subscriptionPlan.update({ where: { code: p.code }, data: { priceMinor: p.priceMinor, features: p.features, description: p.description } });
    }
  }
  await db.systemSetting.upsert({
    where: { key: "promotion.featured7d" },
    create: { key: "promotion.featured7d", value: { priceMinor: (100n * 100n).toString(), currency: "SLE" } },
    update: {},
  });
  await db.systemSetting.upsert({
    where: { key: "site.announcement" },
    create: { key: "site.announcement", value: { text: "Never pay for a property before inspecting it and checking the documents.", link: "/safety", enabled: true } },
    update: {},
  });
  const pages = [
    { slug: "about", title: "About Sukkot Salone", body: "Sukkot Salone helps people across Sierra Leone find, rent, buy and manage property with more trust and less hassle." },
  ];
  for (const p of pages) await db.contentPage.upsert({ where: { slug: p.slug }, create: p, update: {} });
}

/* --------------------------------------------------------------- Demo data */

async function writeDemoImage(key: string, svg: string) {
  if (process.env.STORAGE_DRIVER === "s3") {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ region: process.env.S3_REGION || "auto", endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: !!process.env.S3_ENDPOINT, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" } });
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `public/${key}`, Body: svg, ContentType: "image/svg+xml" }));
    return;
  }
  if (process.env.STORAGE_DRIVER === "database") {
    const body = new Uint8Array(Buffer.from(svg));
    await db.storedFile.upsert({ where: { visibility_key: { visibility: "public", key } }, create: { visibility: "public", key, contentType: "image/svg+xml", size: body.length, body }, update: { contentType: "image/svg+xml", size: body.length, body } });
    return;
  }
  const file = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || "./storage", "public", key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, svg);
}

async function demoUser(email: string, fullName: string, roles: ("OWNER" | "AGENT" | "SUPER_ADMIN" | "MODERATOR" | "VERIFICATION_OFFICER" | "SUPPORT" | "FINANCE")[], phone: string, extra: { showPhone?: boolean; whatsapp?: string; bio?: string } = {}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      phone,
      passwordHash,
      isDemo: true,
      emailVerifiedAt: new Date(),
      profile: { create: { fullName, showPhone: extra.showPhone ?? false, whatsapp: extra.whatsapp, bio: extra.bio } },
      roles: { create: [{ role: "USER" }, ...roles.map((role) => ({ role }))] },
    },
    update: {},
  });
  return user;
}

async function verify(userId: string, kind: "IDENTITY" | "AGENT_CREDENTIALS", reviewerId: string) {
  const exists = await db.verificationRequest.findFirst({ where: { userId, kind, propertyId: null } });
  if (exists) return;
  await db.verificationRequest.create({
    data: { userId, kind, status: "VERIFIED", reviewerId, decisionNote: "Demo data: marked verified for demonstration only.", decidedAt: new Date() },
  });
}

interface DemoListing {
  title: string;
  description: string;
  type: string;
  purpose: ListingPurpose;
  price: number;
  currency?: "SLE" | "USD";
  period?: RentalPeriod;
  negotiable?: boolean;
  beds?: number;
  baths?: number;
  floor?: number;
  plot?: number;
  plotUnit?: AreaUnit;
  furnishing?: Furnishing;
  water?: WaterSupply;
  power?: Electricity;
  parking?: number;
  location: string;
  lister: "landlord" | "landlord2" | "agent";
  capacity?: ListerCapacity;
  amenities: string[];
  art: DemoKind;
  docsReviewed?: boolean;
  featured?: boolean;
  attributes?: Record<string, unknown>;
  rentalTerms?: Record<string, unknown>;
  daysAgo: number;
}

const LISTINGS: DemoListing[] = [
  { title: "Furnished 2-bedroom apartment in Aberdeen", description: "Bright, fully furnished two-bedroom apartment a short walk from Lumley Beach. Both bedrooms are en suite, the kitchen is fitted, and the compound has a standby generator, water tank and 24-hour security. Suitable for professionals or a small family.", type: "apartment", purpose: "RENT", price: 42_000, period: "MONTH", beds: 2, baths: 2, floor: 110, furnishing: "FURNISHED", water: "GUMA_MAINS", power: "GRID_WITH_BACKUP", parking: 1, location: "aberdeen", lister: "landlord", amenities: ["backup-generator", "water-tank", "security-guard", "air-conditioning", "fitted-kitchen", "parking"], art: "apartment", docsReviewed: true, featured: true, rentalTerms: { advanceRentPeriods: 6, minLeaseMonths: 12, utilitiesPaidBy: "TENANT", maintenanceBy: "LANDLORD", petsAllowed: "ON_REQUEST" }, daysAgo: 2 },
  { title: "4-bedroom villa with sea view, Hill Station", description: "Spacious four-bedroom family villa on the hills above Freetown with panoramic sea views. Large living and dining area, boys' quarters, mature garden and a solar plus inverter system for steady power.", type: "house", purpose: "RENT", price: 85_000, period: "MONTH", beds: 4, baths: 4, floor: 320, furnishing: "SEMI_FURNISHED", water: "BOREHOLE", power: "SOLAR", parking: 3, location: "hill-station", lister: "agent", capacity: "AGENT_FOR_OWNER", amenities: ["sea-view", "solar-power", "inverter", "boys-quarters", "garden", "perimeter-wall", "parking"], art: "house", docsReviewed: true, featured: true, rentalTerms: { advanceRentPeriods: 12, minLeaseMonths: 12, utilitiesPaidBy: "TENANT", maintenanceBy: "SHARED" }, daysAgo: 5 },
  { title: "Half town lot with survey plan, Waterloo", description: "Dry, level half town lot in a developing residential area of Waterloo, close to the main road. Survey plan available for inspection. Ideal for a family home.", type: "empty-land", purpose: "SALE", price: 180_000, negotiable: true, plot: 0.5, plotUnit: "TOWN_LOT", location: "lumpa", lister: "landlord2", amenities: ["tarred-road-access"], art: "land", docsReviewed: true, attributes: { landUse: "RESIDENTIAL", accessRoad: "LATERITE", fenced: false, surveyPlanRef: "DEMO-SP-0042", titleDocumentType: "CONVEYANCE" }, daysAgo: 8 },
  { title: "Family house near Bo town centre", description: "Well kept five-bedroom family house in New London, Bo, with a fenced compound, borehole and space for a vegetable garden. Walking distance to schools and the market.", type: "house", purpose: "SALE", price: 950_000, negotiable: true, beds: 5, baths: 3, floor: 280, plot: 0.75, plotUnit: "TOWN_LOT", furnishing: "UNFURNISHED", water: "BOREHOLE", power: "EDSA_GRID", parking: 2, location: "new-london", lister: "landlord2", amenities: ["borehole", "perimeter-wall", "near-school", "near-market", "garden"], art: "house", daysAgo: 12 },
  { title: "Ground-floor shop on Azzolini Highway, Makeni", description: "Ground-floor retail unit with roller shutters on a busy stretch of Azzolini Highway. Suitable for a pharmacy, phone shop or mini-mart.", type: "shop", purpose: "LEASE", price: 60_000, period: "YEAR", floor: 45, water: "GUMA_MAINS", power: "EDSA_GRID", location: "azzolini-highway", lister: "agent", capacity: "AGENT_FOR_OWNER", amenities: ["tarred-road-access", "cctv"], art: "commercial", docsReviewed: true, attributes: { permittedUse: "Retail", floors: 1, loadingAccess: true, wheelchairAccessible: true }, daysAgo: 3 },
  { title: "10 acres of agricultural land, Nongowa", description: "Ten acres of fertile farmland near Kenema, currently partly planted with cassava. Seasonal stream on the eastern boundary. Available on a long lease.", type: "empty-land", purpose: "LEASE", price: 25_000, period: "YEAR", plot: 10, plotUnit: "ACRE", location: "nongowa", lister: "landlord", amenities: [], art: "farm", attributes: { landUse: "AGRICULTURAL", accessRoad: "FOOTPATH", titleDocumentType: "CUSTOMARY" }, daysAgo: 20 },
  { title: "Residential plots in Koidu, Kono District", description: "Two adjoining residential plots in Tankoro, Koidu, on a laterite road with neighbouring homes already connected to the grid. Can be bought together or separately.", type: "empty-land", purpose: "SALE", price: 120_000, negotiable: true, plot: 1, plotUnit: "TOWN_LOT", location: "tankoro", lister: "agent", capacity: "AGENT_FOR_OWNER", amenities: [], art: "land", attributes: { landUse: "RESIDENTIAL", accessRoad: "LATERITE", titleDocumentType: "STATE_GRANT" }, daysAgo: 15 },
  { title: "Office and warehouse space on Hangha Road, Kenema", description: "Two-storey commercial building with 180 m² of office space upstairs and a 250 m² warehouse at street level with loading bay.", type: "commercial", purpose: "RENT", price: 30_000, period: "MONTH", floor: 430, water: "BOREHOLE", power: "GENERATOR", parking: 4, location: "hangha-road", lister: "landlord2", amenities: ["parking", "security-guard", "backup-generator"], art: "commercial", attributes: { permittedUse: "Office, storage", floors: 2, loadingAccess: true }, daysAgo: 6 },
  { title: "Residential plot in Rogbaneh, Makeni", description: "Quarter town lot residential plot in a quiet part of Makeni, fenced on two sides, with access to mains water nearby.", type: "empty-land", purpose: "SALE", price: 65_000, plot: 0.25, plotUnit: "TOWN_LOT", location: "rogbaneh", lister: "landlord", amenities: [], art: "land", attributes: { landUse: "RESIDENTIAL", accessRoad: "LATERITE", fenced: true, titleDocumentType: "CONVEYANCE" }, daysAgo: 25 },
  { title: "Modern 3-bedroom duplex in Wilberforce", description: "Newly finished three-bedroom duplex in a gated compound with shared generator and water treatment. Open-plan ground floor and a balcony upstairs.", type: "house", purpose: "SALE", price: 220_000, currency: "USD", negotiable: true, beds: 3, baths: 3, floor: 210, furnishing: "UNFURNISHED", water: "MIXED", power: "GRID_WITH_BACKUP", parking: 2, location: "wilberforce", lister: "agent", capacity: "AGENT_FOR_DEVELOPER", amenities: ["gated-compound", "backup-generator", "balcony", "fitted-kitchen", "cctv"], art: "house", featured: true, daysAgo: 1 },
  { title: "Beachside studio for short stays, Tokeh", description: "Cosy furnished studio steps from Tokeh Beach, ideal for weekend getaways. Wi-Fi, solar power and daily cleaning included.", type: "short-stay", purpose: "SHORT_STAY", price: 1_200, period: "DAY", beds: 1, baths: 1, floor: 35, furnishing: "FURNISHED", water: "TANKER", power: "SOLAR", parking: 1, location: "tokeh-beach", lister: "landlord", amenities: ["sea-view", "solar-power", "internet-ready", "cleaning-service"], art: "shortstay", daysAgo: 4 },
  { title: "3-bedroom bungalow for rent in Juba", description: "Comfortable three-bedroom bungalow on a quiet street in Juba with a fenced yard and water tank. Close to Lumley and Wilkinson Road.", type: "house", purpose: "RENT", price: 28_000, period: "MONTH", beds: 3, baths: 2, floor: 160, furnishing: "UNFURNISHED", water: "GUMA_MAINS", power: "EDSA_GRID", parking: 1, location: "juba", lister: "landlord2", amenities: ["water-tank", "perimeter-wall", "ceiling-fans"], art: "house", rentalTerms: { advanceRentPeriods: 12, minLeaseMonths: 12, utilitiesPaidBy: "TENANT", maintenanceBy: "TENANT", petsAllowed: "YES" }, daysAgo: 9 },
  { title: "Commercial plot on the Bo–Kenema highway", description: "Roadside commercial plot suitable for a filling station, shop or warehouse, with frontage on the highway.", type: "empty-land", purpose: "SALE", price: 400_000, negotiable: true, plot: 1.5, plotUnit: "ACRE", location: "tikonko-road", lister: "agent", capacity: "AGENT_FOR_OWNER", amenities: ["tarred-road-access"], art: "land", attributes: { landUse: "COMMERCIAL", accessRoad: "TARRED", titleDocumentType: "CONVEYANCE" }, daysAgo: 30 },
  { title: "Self-contained studio in Brookfields", description: "Self-contained studio with its own kitchenette and shower, in a well maintained compound close to the stadium.", type: "studio", purpose: "RENT", price: 6_500, period: "MONTH", beds: 1, baths: 1, floor: 28, furnishing: "SEMI_FURNISHED", water: "GUMA_MAINS", power: "EDSA_GRID", location: "brookfields", lister: "landlord", amenities: ["ceiling-fans"], art: "apartment", rentalTerms: { advanceRentPeriods: 6, minLeaseMonths: 6, utilitiesPaidBy: "TENANT" }, daysAgo: 11 },
];

async function seedDemo() {
  const admin = await demoUser("admin@demo.sukkot.sl", "Demo Administrator", ["SUPER_ADMIN"], "+23276000001");
  await demoUser("moderator@demo.sukkot.sl", "Demo Moderator", ["MODERATOR"], "+23276000002");
  await demoUser("verifier@demo.sukkot.sl", "Demo Verification Officer", ["VERIFICATION_OFFICER"], "+23276000003");
  await demoUser("finance@demo.sukkot.sl", "Demo Finance Officer", ["FINANCE"], "+23276000004");
  const landlord = await demoUser("landlord@demo.sukkot.sl", "Aminata Conteh (Demo)", ["OWNER"], "+23276100100", { showPhone: true, whatsapp: "+23276100100", bio: "Fictional demo landlord with apartments in Freetown." });
  const landlord2 = await demoUser("landlord2@demo.sukkot.sl", "Ibrahim Sesay (Demo)", ["OWNER"], "+23277200200", { bio: "Fictional demo owner with property in Bo, Kenema and Freetown." });
  const agent = await demoUser("agent@demo.sukkot.sl", "Fatmata Bangura (Demo)", ["AGENT"], "+23230300300", { showPhone: true, whatsapp: "+23230300300", bio: "Fictional demo agent at Lion Mountain Realty (Demo)." });
  const tenant = await demoUser("tenant@demo.sukkot.sl", "Mohamed Kamara (Demo)", [], "+23278400400");
  const buyer = await demoUser("buyer@demo.sukkot.sl", "Hawa Koroma (Demo)", [], "+23233500500");

  // Demo plans so the paid features can be tried: the landlord and agent are on Pro, landlord2 stays
  // on the free plan (and is over its limit, which shows the upgrade prompt).
  for (const [userId, code] of [[landlord.id, "landlord-pro"], [agent.id, "agent-pro"]] as const) {
    if (await db.subscription.count({ where: { userId } })) continue;
    const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { code } });
    await db.subscription.create({ data: { userId, planId: plan.id, status: "ACTIVE", startsAt: new Date(), endsAt: new Date(Date.now() + plan.periodDays * 86400_000) } });
  }

  const agency = await db.agency.upsert({
    where: { slug: "lion-mountain-realty-demo" },
    create: { name: "Lion Mountain Realty (Demo)", slug: "lion-mountain-realty-demo", description: "Fictional demonstration agency.", phone: "+23230300300", email: "agency@demo.sukkot.sl", address: "Siaka Stevens Street, Freetown (fictional)", isDemo: true },
    update: {},
  });
  await db.agencyMember.upsert({ where: { agencyId_userId: { agencyId: agency.id, userId: agent.id } }, create: { agencyId: agency.id, userId: agent.id, role: "OWNER", title: "Principal agent" }, update: {} });

  await verify(landlord.id, "IDENTITY", admin.id);
  await verify(agent.id, "IDENTITY", admin.id);
  await verify(agent.id, "AGENT_CREDENTIALS", admin.id);

  const listers = { landlord, landlord2, agent };
  const types = await db.propertyType.findMany();
  const amenities = await db.amenity.findMany();
  const created: Record<string, string> = {};
  for (const [i, l] of LISTINGS.entries()) {
    const reference = `SS-26-DEMO${String(i + 1).padStart(2, "0")}`;
    const existing = await db.property.findUnique({ where: { reference } });
    if (existing) {
      created[l.title] = existing.id;
      continue;
    }
    const type = types.find((t) => t.slug === l.type)!;
    const loc = await db.location.findUniqueOrThrow({ where: { slug: l.location } });
    const lister = listers[l.lister];
    const publishedAt = new Date(Date.now() - l.daysAgo * 86400_000);
    const p = await db.property.create({
      data: {
        reference,
        slug: `${slugify(l.title).slice(0, 60)}-${reference.toLowerCase()}`,
        ownerId: lister.id,
        listerId: lister.id,
        agencyId: l.lister === "agent" ? agency.id : null,
        listerCapacity: l.capacity ?? "OWNER",
        title: l.title,
        description: `${l.description}\n\nThis is a fictional demonstration listing.`,
        propertyTypeId: type.id,
        category: type.category,
        purpose: l.purpose,
        priceMinor: BigInt(l.price) * 100n,
        currency: l.currency ?? "SLE",
        rentalPeriod: l.period ?? null,
        negotiable: l.negotiable ?? false,
        bedrooms: l.beds ?? null,
        bathrooms: l.baths ?? null,
        floorArea: l.floor ?? null,
        plotSize: l.plot ?? null,
        plotUnit: l.plotUnit ?? null,
        furnishing: l.furnishing ?? null,
        waterSupply: l.water ?? null,
        electricity: l.power ?? null,
        parkingSpaces: l.parking ?? null,
        locationId: loc.id,
        locationPathIds: loc.pathIds,
        attributes: (l.attributes ?? {}) as Prisma.InputJsonValue,
        rentalTerms: (l.rentalTerms as Prisma.InputJsonValue | undefined) ?? undefined,
        listingStatus: "PUBLISHED",
        documentsStatus: l.docsReviewed ? "VERIFIED" : "NOT_SUBMITTED",
        isFeatured: !!l.featured,
        isDemo: true,
        viewCount: 20 + ((i * 37) % 180),
        publishedAt,
        createdAt: publishedAt,
        amenities: { create: l.amenities.map((slug) => amenities.find((a) => a.slug === slug)).filter(Boolean).map((a) => ({ amenityId: a!.id })) },
        statusHistory: { create: [{ field: "listingStatus", fromValue: "PENDING_REVIEW", toValue: "PUBLISHED", reason: "Demo data", actorId: admin.id }] },
      },
    });
    for (let k = 0; k < 3; k++) {
      const key = `demo/${reference.toLowerCase()}-${k + 1}.svg`;
      await writeDemoImage(key, demoSvg(l.art, i * 3 + k + 1, l.title));
      await db.propertyImage.create({ data: { propertyId: p.id, storageKey: key, width: 1600, height: 1200, sortOrder: k, illustrative: true, alt: `Illustrative artwork for ${l.title}` } });
    }
    created[l.title] = p.id;
  }

  // A sample enquiry thread, inspection, rental application and offer negotiation.
  const aberdeen = created[LISTINGS[0]!.title]!;
  const plot = created[LISTINGS[2]!.title]!;
  if (!(await db.enquiry.findFirst({ where: { propertyId: aberdeen, userId: tenant.id } }))) {
    const convo = await db.conversation.create({
      data: { subject: `${LISTINGS[0]!.title} (SS-26-DEMO01)`, propertyId: aberdeen, participants: { create: [{ userId: tenant.id, lastReadAt: new Date() }, { userId: landlord.id }] } },
    });
    await db.message.createMany({
      data: [
        { conversationId: convo.id, senderId: tenant.id, body: "Hello, is the apartment still available from next month? I work nearby and would like to view it.", createdAt: new Date(Date.now() - 3600_000 * 20) },
        { conversationId: convo.id, senderId: landlord.id, body: "Yes, it is available. You are welcome to come and see it. Saturday morning works for me.", createdAt: new Date(Date.now() - 3600_000 * 18) },
      ],
    });
    await db.enquiry.create({ data: { propertyId: aberdeen, userId: tenant.id, intent: "RENT", message: "Hello, is the apartment still available from next month?", conversationId: convo.id } });
    const sat = new Date();
    sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
    sat.setUTCHours(10, 0, 0, 0);
    await db.inspection.create({ data: { propertyId: aberdeen, requesterId: tenant.id, representativeId: landlord.id, scheduledAt: sat, status: "CONFIRMED", notes: "Will come with my brother." } });
    await db.rentalApplication.create({
      data: {
        propertyId: aberdeen,
        applicantId: tenant.id,
        status: "SUBMITTED",
        moveInDate: new Date(Date.now() + 30 * 86400_000),
        leaseMonths: 12,
        occupants: 2,
        employmentStatus: "EMPLOYED",
        employerOrBusiness: "Fictional Trading Ltd",
        message: "Quiet professional couple, no pets.",
        submittedAt: new Date(),
        events: { create: { actorId: tenant.id, action: "submit", toStatus: "SUBMITTED" } },
      },
    });
  }
  if (!(await db.offer.findFirst({ where: { propertyId: plot, buyerId: buyer.id } }))) {
    const offer = await db.offer.create({
      data: {
        propertyId: plot,
        buyerId: buyer.id,
        status: "COUNTEROFFER_RECEIVED",
        currentAmountMinor: 170_000n * 100n,
        currency: "SLE",
        paymentArrangement: "INSTALMENTS",
        events: {
          create: [
            { type: "SUBMITTED", actorId: buyer.id, actorSide: "BUYER", amountMinor: 150_000n * 100n, currency: "SLE", conditions: ["Subject to a satisfactory survey check"], message: "I can pay in two instalments.", statusAfter: "SUBMITTED", createdAt: new Date(Date.now() - 3 * 86400_000) },
            { type: "COUNTERED", actorId: landlord2.id, actorSide: "SELLER", amountMinor: 170_000n * 100n, currency: "SLE", conditions: ["50% on signing, balance within 60 days"], message: "I can meet you at 170,000.", statusAfter: "COUNTEROFFER_RECEIVED", createdAt: new Date(Date.now() - 2 * 86400_000) },
          ],
        },
        dueDiligence: { create: DUE_DILIGENCE_TEMPLATE.map((t, i) => ({ key: t.key, title: t.title, guidance: t.guidance, sortOrder: i })) },
      },
    });
    await db.conversation.create({
      data: { subject: `Offer: ${LISTINGS[2]!.title} (SS-26-DEMO03)`, propertyId: plot, offerId: offer.id, participants: { create: [{ userId: buyer.id }, { userId: landlord2.id }] }, messages: { create: [{ senderId: buyer.id, body: "Offer submitted: Le 150,000.", isSystem: true }, { senderId: landlord2.id, body: "Counteroffer: Le 170,000.", isSystem: true }] } },
    });
  }
}

async function main() {
  await seedLocations();
  await seedCatalog();
  if (withDemo) {
    await seedDemo();
    console.log(`Seeded demo data. Demo accounts (local development only) use the password "${DEMO_PASSWORD}":`);
    console.log("  admin@demo.sukkot.sl, moderator@demo.sukkot.sl, verifier@demo.sukkot.sl, finance@demo.sukkot.sl,");
    console.log("  landlord@demo.sukkot.sl, landlord2@demo.sukkot.sl, agent@demo.sukkot.sl, tenant@demo.sukkot.sl, buyer@demo.sukkot.sl");
  } else {
    console.log("Production seed: reference data only. Create the first administrator with `pnpm admin:create`.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
