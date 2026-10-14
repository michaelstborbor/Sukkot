import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type Property } from "@prisma/client";
import {
  DEFAULT_PER_PAGE,
  formatMoney,
  listingMachine,
  parseMajorToMinor,
  propertyInputSchema,
  slugify,
  validatePropertyForCategory,
  type Availability,
  type ListingAction,
  type Paginated,
  type PropertyDetailDTO,
  type PropertySummaryDTO,
  type SearchFilters,
  type VerificationKind,
  LISTING_ACTIONS_REQUIRING_REASON,
} from "@sukkot/shared";
import { db, type Tx } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { actorIsStaff, assertPermission, can } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";
import { publicImageUrl, storage } from "../storage";
import { assertListingCapacity } from "./billing";
import { storeImage, storePrivateDocument } from "../uploads";

/* ------------------------------------------------------------ Includes */

const locationChain = {
  include: { parent: { include: { parent: { include: { parent: true } } } } },
} satisfies Prisma.LocationDefaultArgs;

const listerSelect = {
  select: {
    id: true,
    phone: true,
    isDemo: true,
    createdAt: true,
    roles: { select: { role: true } },
    profile: { select: { fullName: true, avatarKey: true, whatsapp: true, showPhone: true } },
    verificationRequests: {
      where: { status: "VERIFIED", propertyId: null, kind: { in: ["IDENTITY", "AGENT_CREDENTIALS"] } },
      select: { kind: true, expiresAt: true },
    },
  },
} satisfies Prisma.UserDefaultArgs;

export const summaryInclude = {
  propertyType: { select: { name: true, slug: true } },
  location: locationChain,
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
  lister: listerSelect,
} satisfies Prisma.PropertyInclude;

const detailInclude = {
  ...summaryInclude,
  images: { orderBy: { sortOrder: "asc" } },
  amenities: { include: { amenity: true } },
  agency: { select: { id: true, name: true } },
} satisfies Prisma.PropertyInclude;

type SummaryRow = Prisma.PropertyGetPayload<{ include: typeof summaryInclude }>;
type DetailRow = Prisma.PropertyGetPayload<{ include: typeof detailInclude }>;
type LocationRow = Prisma.LocationGetPayload<typeof locationChain>;

/* --------------------------------------------------------- Serialisers */

function locationParts(loc: LocationRow) {
  const chain: { name: string; level: string }[] = [];
  let cur: { name: string; level: string; parent?: unknown } | null | undefined = loc;
  while (cur) {
    chain.push({ name: cur.name, level: cur.level });
    cur = (cur as { parent?: typeof cur }).parent ?? null;
  }
  const district = chain.find((c) => c.level === "DISTRICT")?.name ?? null;
  const city = chain.find((c) => c.level === "CITY")?.name ?? null;
  const locality = chain.find((c) => c.level === "LOCALITY")?.name ?? null;
  const label = [locality, city ?? district].filter(Boolean).join(", ") || loc.name;
  return { district, city, locality, label };
}

function activeBadges(rows: { kind: string; expiresAt: Date | null }[]): VerificationKind[] {
  const now = new Date();
  return [...new Set(rows.filter((r) => !r.expiresAt || r.expiresAt > now).map((r) => r.kind as VerificationKind))];
}

function imageDto(img: { id: string; storageKey: string; width: number | null; height: number | null; alt: string | null; illustrative: boolean }, title: string) {
  return {
    id: img.id,
    url: publicImageUrl(img.storageKey, 1600),
    thumbUrl: publicImageUrl(img.storageKey, 480),
    width: img.width,
    height: img.height,
    alt: img.alt ?? title,
    illustrative: img.illustrative,
  };
}

export function toSummary(p: SummaryRow & { isFeatured: boolean }): PropertySummaryDTO {
  const loc = locationParts(p.location);
  const badges = activeBadges(p.lister.verificationRequests);
  return {
    id: p.id,
    reference: p.reference,
    slug: p.slug,
    title: p.title,
    category: p.category,
    typeName: p.propertyType.name,
    purpose: p.purpose,
    price: {
      amountMinor: p.priceMinor.toString(),
      currency: p.currency,
      formatted: formatMoney(p.priceMinor, p.currency, { period: p.rentalPeriod }),
    },
    rentalPeriod: p.rentalPeriod,
    negotiable: p.negotiable,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    floorArea: p.floorArea ? `${p.floorArea.toString()} ${unitLabel(p.floorAreaUnit)}` : null,
    plotSize: p.plotSize && p.plotUnit ? `${p.plotSize.toString()} ${unitLabel(p.plotUnit)}` : null,
    locationLabel: loc.label,
    district: loc.district,
    coverImage: p.images[0] ? imageDto(p.images[0], p.title) : null,
    availability: p.availability,
    documentsReviewed: p.documentsStatus === "VERIFIED",
    listerVerified: badges.length > 0,
    featured: p.isFeatured,
    isDemo: p.isDemo,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function unitLabel(u: string) {
  return ({ SQM: "m²", SQFT: "ft²", ACRE: "acres", HECTARE: "ha", TOWN_LOT: "town lot" } as Record<string, string>)[u] ?? u;
}

function toDetail(p: DetailRow, opts: { saved: boolean; canSeeExact: boolean }): PropertyDetailDTO {
  const summary = toSummary(p);
  const badges = activeBadges(p.lister.verificationRequests);
  const isAgent = p.listerCapacity !== "OWNER" && p.listerCapacity !== "DEVELOPER";
  const profile = p.lister.profile;
  let coordinates: PropertyDetailDTO["coordinates"] = null;
  if (p.latitude !== null && p.longitude !== null) {
    if (p.showExactLocation || opts.canSeeExact) coordinates = { lat: p.latitude, lng: p.longitude, approximate: false };
    else {
      // Round to ~1km so the map shows the neighbourhood, not the house.
      coordinates = { lat: Math.round(p.latitude * 100) / 100, lng: Math.round(p.longitude * 100) / 100, approximate: true };
    }
  } else if (p.location.latitude !== null && p.location.longitude !== null) {
    coordinates = { lat: p.location.latitude, lng: p.location.longitude, approximate: true };
  }
  return {
    ...summary,
    description: p.description,
    images: p.images.map((i) => imageDto(i, p.title)),
    amenities: p.amenities.map((a) => ({ id: a.amenity.id, name: a.amenity.name, slug: a.amenity.slug, group: a.amenity.group })),
    furnishing: p.furnishing,
    waterSupply: p.waterSupply,
    electricity: p.electricity,
    parkingSpaces: p.parkingSpaces,
    securityFeatures: p.securityFeatures,
    addressLine: p.showExactLocation || opts.canSeeExact ? p.addressLine : null,
    coordinates,
    availableFrom: p.availableFrom?.toISOString() ?? null,
    videoUrl: p.videoUrl,
    virtualTourUrl: p.virtualTourUrl,
    attributes: (p.attributes ?? {}) as Record<string, unknown>,
    rentalTerms: (p.rentalTerms ?? null) as Record<string, unknown> | null,
    listerCapacity: p.listerCapacity,
    lister: {
      id: p.lister.id,
      name: profile?.fullName ?? "Lister",
      avatarUrl: profile?.avatarKey ? publicImageUrl(profile.avatarKey, 480) : null,
      kind: isAgent ? "AGENT" : "OWNER",
      agencyName: p.agency?.name ?? null,
      agencyId: p.agency?.id ?? null,
      badges,
      memberSince: p.lister.createdAt.toISOString(),
      phone: profile?.showPhone ? p.lister.phone : null,
      whatsapp: profile?.showPhone ? (profile.whatsapp ?? null) : null,
      isDemo: p.lister.isDemo,
    },
    viewCount: p.viewCount,
    saved: opts.saved,
    listingStatus: p.listingStatus,
  };
}

/* ---------------------------------------------------------------- Search */

async function resolveLocationIds(filters: SearchFilters): Promise<string | null | undefined> {
  const slug = filters.locality ?? filters.city ?? filters.district ?? filters.province;
  if (!slug) return undefined;
  const loc = await db.location.findUnique({ where: { slug }, select: { id: true } });
  return loc?.id ?? null;
}

export async function buildSearchWhere(filters: SearchFilters): Promise<Prisma.PropertyWhereInput | null> {
  const and: Prisma.PropertyWhereInput[] = [{ listingStatus: "PUBLISHED" }];
  if (filters.purpose) and.push({ purpose: filters.purpose });
  if (filters.category) and.push({ category: filters.category });
  if (filters.type?.length) and.push({ propertyType: { slug: { in: filters.type } } });

  const locationId = await resolveLocationIds(filters);
  if (locationId === null) return null; // Unknown location slug → no results rather than everything.
  if (locationId) and.push({ locationPathIds: { has: locationId } });

  const currency = filters.currency ?? (filters.minPrice !== undefined || filters.maxPrice !== undefined ? "SLE" : undefined);
  if (currency) and.push({ currency });
  const minMinor = filters.minPrice !== undefined ? parseMajorToMinor(String(Math.floor(filters.minPrice)), currency) : null;
  const maxMinor = filters.maxPrice !== undefined ? parseMajorToMinor(String(Math.ceil(filters.maxPrice)), currency) : null;
  if (minMinor !== null || maxMinor !== null) {
    and.push({ priceMinor: { ...(minMinor !== null ? { gte: minMinor } : {}), ...(maxMinor !== null ? { lte: maxMinor } : {}) } });
  }
  if (filters.beds !== undefined) and.push({ bedrooms: { gte: filters.beds } });
  if (filters.baths !== undefined) and.push({ bathrooms: { gte: filters.baths } });
  if (filters.minArea !== undefined || filters.maxArea !== undefined) {
    and.push({ floorArea: { ...(filters.minArea !== undefined ? { gte: filters.minArea } : {}), ...(filters.maxArea !== undefined ? { lte: filters.maxArea } : {}) } });
  }
  if (filters.minPlot !== undefined || filters.maxPlot !== undefined) {
    and.push({ plotSize: { ...(filters.minPlot !== undefined ? { gte: filters.minPlot } : {}), ...(filters.maxPlot !== undefined ? { lte: filters.maxPlot } : {}) } });
  }
  if (filters.furnishing?.length) and.push({ furnishing: { in: filters.furnishing } });
  if (filters.water?.length) and.push({ waterSupply: { in: filters.water } });
  if (filters.power?.length) and.push({ electricity: { in: filters.power } });
  for (const slug of filters.amenities ?? []) and.push({ amenities: { some: { amenity: { slug } } } });
  if (filters.parking) and.push({ parkingSpaces: { gt: 0 } });
  if (filters.verified) and.push({ documentsStatus: "VERIFIED" });
  if (filters.listedBy === "OWNER") and.push({ listerCapacity: { in: ["OWNER", "DEVELOPER"] } });
  if (filters.listedBy === "AGENT") and.push({ listerCapacity: { in: ["AGENT_FOR_OWNER", "AGENT_FOR_DEVELOPER", "OTHER_AUTHORISED"] } });
  if (filters.listedWithin) and.push({ publishedAt: { gte: new Date(Date.now() - filters.listedWithin * 86400_000) } });
  if (filters.availableOnly) and.push({ availability: "AVAILABLE" });
  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { reference: { equals: q.toUpperCase() } },
        { location: { name: { contains: q, mode: "insensitive" } } },
        { location: { parent: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  return { AND: and };
}

function orderBy(sort: SearchFilters["sort"]): Prisma.PropertyOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ publishedAt: "desc" }, { id: "desc" }];
    case "price_asc":
      return [{ priceMinor: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ priceMinor: "desc" }, { id: "desc" }];
    case "updated":
      return [{ updatedAt: "desc" }, { id: "desc" }];
    case "views":
      return [{ viewCount: "desc" }, { id: "desc" }];
    default:
      return [{ isFeatured: "desc" }, { documentsStatus: "desc" }, { publishedAt: "desc" }, { id: "desc" }];
  }
}

export async function searchProperties(filters: SearchFilters): Promise<Paginated<PropertySummaryDTO>> {
  const perPage = filters.perPage ?? DEFAULT_PER_PAGE;
  const page = filters.page ?? 1;
  const where = await buildSearchWhere(filters);
  if (!where) return { items: [], page, perPage, total: 0, totalPages: 0 };
  const [total, rows] = await Promise.all([
    db.property.count({ where }),
    db.property.findMany({ where, include: summaryInclude, orderBy: orderBy(filters.sort), skip: (page - 1) * perPage, take: perPage }),
  ]);
  return { items: rows.map(toSummary), page, perPage, total, totalPages: Math.ceil(total / perPage) };
}

export async function listProperties(where: Prisma.PropertyWhereInput, take: number, order: Prisma.PropertyOrderByWithRelationInput[] = [{ publishedAt: "desc" }]) {
  const rows = await db.property.findMany({ where: { listingStatus: "PUBLISHED", ...where }, include: summaryInclude, orderBy: order, take });
  return rows.map(toSummary);
}

export async function getSummariesByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.property.findMany({ where: { id: { in: ids }, listingStatus: "PUBLISHED" }, include: summaryInclude });
  return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean).map((r) => toSummary(r!));
}

/* ---------------------------------------------------------------- Detail */

function isManager(actor: Actor | null, p: Pick<Property, "ownerId" | "listerId">) {
  return !!actor && (actor.id === p.listerId || actor.id === p.ownerId);
}

/** Public visibility rule: only published listings, unless you manage it or are staff. */
export async function getPropertyDetail(slugOrId: string, actor: Actor | null): Promise<PropertyDetailDTO | null> {
  const p = await db.property.findFirst({ where: { OR: [{ slug: slugOrId }, { id: slugOrId }] }, include: detailInclude });
  if (!p) return null;
  const manager = isManager(actor, p);
  if (p.listingStatus !== "PUBLISHED" && !manager && !actorIsStaff(actor)) return null;
  const saved = actor ? !!(await db.savedProperty.findUnique({ where: { userId_propertyId: { userId: actor.id, propertyId: p.id } } })) : false;
  return toDetail(p, { saved, canSeeExact: manager || actorIsStaff(actor) });
}

export async function recordView(propertyId: string) {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  await db.$transaction([
    db.property.update({ where: { id: propertyId }, data: { viewCount: { increment: 1 } } }),
    db.propertyViewDaily.upsert({
      where: { propertyId_day: { propertyId, day } },
      create: { propertyId, day, views: 1 },
      update: { views: { increment: 1 } },
    }),
  ]);
}

export async function similarProperties(p: { id: string; category: string; purpose: string; district: string | null }, take = 4) {
  const district = p.district ? await db.location.findFirst({ where: { name: p.district, level: "DISTRICT" }, select: { id: true } }) : null;
  return listProperties(
    {
      id: { not: p.id },
      category: p.category as Property["category"],
      purpose: p.purpose as Property["purpose"],
      ...(district ? { locationPathIds: { has: district.id } } : {}),
    },
    take,
  );
}

/* ----------------------------------------------------------- Create/edit */

function newReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `SS-${new Date().getUTCFullYear().toString().slice(2)}-${code}`;
}

async function prepareData(input: unknown) {
  const data = propertyInputSchema.parse(input);
  const [type, location] = await Promise.all([
    db.propertyType.findFirst({ where: { id: data.propertyTypeId, isActive: true } }),
    db.location.findFirst({ where: { id: data.locationId, isActive: true } }),
  ]);
  if (!type) throw new AppError("VALIDATION", "Choose a property type", { propertyTypeId: "Choose a property type" });
  if (!location || (location.level !== "CITY" && location.level !== "LOCALITY")) {
    throw new AppError("VALIDATION", "Choose a town or neighbourhood", { locationId: "Choose a town or neighbourhood" });
  }
  const categoryErrors = validatePropertyForCategory(data, type.category);
  if (categoryErrors.length) {
    throw new AppError("VALIDATION", "Please check the highlighted fields", Object.fromEntries(categoryErrors.map((e) => [e.path, e.message])));
  }
  const amenities = data.amenityIds.length
    ? await db.amenity.findMany({ where: { id: { in: data.amenityIds }, isActive: true }, select: { id: true } })
    : [];
  const priceMinor = parseMajorToMinor(data.price, data.currency)!;
  const rentalTerms =
    data.purpose !== "SALE" && data.rentalTerms
      ? {
          ...data.rentalTerms,
          securityDeposit: data.rentalTerms.securityDeposit
            ? parseMajorToMinor(data.rentalTerms.securityDeposit, data.currency)!.toString()
            : undefined,
        }
      : undefined;
  const attributes = type.category === "LAND" ? (data.land ?? {}) : type.category === "COMMERCIAL" ? (data.commercial ?? {}) : {};
  const fields = {
    title: data.title,
    description: data.description,
    propertyTypeId: type.id,
    category: type.category,
    purpose: data.purpose,
    priceMinor,
    currency: data.currency,
    rentalPeriod: data.purpose === "SALE" ? null : (data.rentalPeriod ?? null),
    negotiable: data.negotiable,
    bedrooms: type.category === "LAND" ? null : (data.bedrooms ?? null),
    bathrooms: type.category === "LAND" ? null : (data.bathrooms ?? null),
    floorArea: data.floorArea ?? null,
    floorAreaUnit: data.floorAreaUnit,
    plotSize: data.plotSize ?? null,
    plotUnit: data.plotUnit ?? null,
    furnishing: data.furnishing ?? null,
    waterSupply: data.waterSupply ?? null,
    electricity: data.electricity ?? null,
    parkingSpaces: data.parkingSpaces ?? null,
    securityFeatures: data.securityFeatures,
    locationId: location.id,
    locationPathIds: location.pathIds,
    addressLine: data.addressLine ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    showExactLocation: data.showExactLocation,
    availableFrom: data.availableFrom ?? null,
    videoUrl: data.videoUrl ?? null,
    virtualTourUrl: data.virtualTourUrl ?? null,
    listerCapacity: data.listerCapacity,
    attributes: attributes as Prisma.InputJsonValue,
    rentalTerms: rentalTerms ? (rentalTerms as Prisma.InputJsonValue) : Prisma.DbNull,
  };
  return { fields, amenityIds: amenities.map((a) => a.id) };
}

export async function createProperty(actorIn: Actor | null, input: unknown) {
  const actor = assertPermission(actorIn, "listing:create");
  const { fields, amenityIds } = await prepareData(input);
  if (fields.listerCapacity !== "OWNER" && fields.listerCapacity !== "DEVELOPER" && !actor.roles.includes("AGENT")) {
    throw new AppError("VALIDATION", "Only agent accounts can list on behalf of someone else", { listerCapacity: "Choose “I am the owner”" });
  }
  const membership = await db.agencyMember.findFirst({ where: { userId: actor.id }, select: { agencyId: true } });
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = newReference();
    try {
      const property = await db.$transaction(async (tx) => {
        const created = await tx.property.create({
          data: {
            ...fields,
            reference,
            slug: `${slugify(fields.title).slice(0, 60)}-${reference.toLowerCase()}`,
            ownerId: actor.id,
            listerId: actor.id,
            agencyId: fields.listerCapacity === "OWNER" ? null : (membership?.agencyId ?? null),
            amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
          },
        });
        await tx.propertyStatusHistory.create({
          data: { propertyId: created.id, field: "listingStatus", toValue: "DRAFT", actorId: actor.id },
        });
        return created;
      });
      return property;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new AppError("INTERNAL", "Could not allocate a listing reference");
}

async function loadManaged(actor: Actor, id: string, tx: Tx | typeof db = db) {
  const p = await tx.property.findUnique({ where: { id } });
  if (!p) throw notFound("Listing");
  if (!isManager(actor, p)) throw forbidden("You can only manage your own listings");
  return p;
}

export async function updateProperty(actorIn: Actor | null, id: string, input: unknown) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  const existing = await loadManaged(actor, id);
  if (existing.listingStatus === "REMOVED" || existing.listingStatus === "SUSPENDED") {
    throw new AppError("CONFLICT", "This listing can no longer be edited");
  }
  const { fields, amenityIds } = await prepareData(input);
  return db.$transaction(async (tx) => {
    await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });
    const updated = await tx.property.update({
      where: { id },
      data: { ...fields, amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) } },
    });
    if (existing.priceMinor !== updated.priceMinor) {
      await tx.propertyStatusHistory.create({
        data: { propertyId: id, field: "price", fromValue: existing.priceMinor.toString(), toValue: updated.priceMinor.toString(), actorId: actor.id },
      });
    }
    return updated;
  });
}

/** Owner-side status transitions (submit, pause, resume, remove). */
export async function ownerListingAction(actorIn: Actor | null, id: string, action: ListingAction) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  if (!["submit", "pause", "resume", "remove"].includes(action)) throw forbidden();
  return db.$transaction(async (tx) => {
    const p = await loadManaged(actor, id, tx);
    if (action === "submit") {
      const imageCount = await tx.propertyImage.count({ where: { propertyId: id } });
      if (imageCount === 0) throw new AppError("VALIDATION", "Add at least one photo before submitting for review");
    }
    if (action === "submit" || action === "resume") await assertListingCapacity(tx, p.listerId, p.id);
    const next = listingMachine.next(p.listingStatus, action, "OWNER");
    const updated = await tx.property.update({ where: { id }, data: { listingStatus: next } });
    await tx.propertyStatusHistory.create({
      data: { propertyId: id, field: "listingStatus", fromValue: p.listingStatus, toValue: next, actorId: actor.id },
    });
    return updated;
  });
}

/** Moderator decisions. Every decision except approve requires a written reason. */
export async function moderateListing(
  actorIn: Actor | null,
  id: string,
  input: { action: ListingAction; reason?: string; markDocumentsReviewed?: boolean; featured?: boolean },
  ipHash?: string | null,
) {
  const actor = assertPermission(actorIn, "admin:listings.moderate");
  if (LISTING_ACTIONS_REQUIRING_REASON.includes(input.action) || input.action === "remove") {
    if (!input.reason || input.reason.trim().length < 5) throw new AppError("VALIDATION", "Give a reason for this decision", { reason: "Required" });
  }
  return db.$transaction(async (tx) => {
    const p = await tx.property.findUnique({ where: { id } });
    if (!p) throw notFound("Listing");
    const next = listingMachine.next(p.listingStatus, input.action, "MODERATOR");
    const data: Prisma.PropertyUpdateInput = { listingStatus: next };
    if (next === "PUBLISHED" && !p.publishedAt) data.publishedAt = new Date();
    if (input.markDocumentsReviewed !== undefined && can(actor, "admin:verification.review")) {
      data.documentsStatus = input.markDocumentsReviewed ? "VERIFIED" : p.documentsStatus;
    }
    if (input.featured !== undefined) data.isFeatured = input.featured;
    const updated = await tx.property.update({ where: { id }, data });
    await tx.propertyStatusHistory.create({
      data: { propertyId: id, field: "listingStatus", fromValue: p.listingStatus, toValue: next, reason: input.reason, actorId: actor.id },
    });
    await tx.moderationAction.create({
      data: { actorId: actor.id, targetType: "Property", targetId: id, action: input.action, reason: input.reason },
    });
    await audit({ actorId: actor.id, action: `listing.${input.action}`, targetType: "Property", targetId: id, metadata: { reason: input.reason ?? null }, ipHash }, tx);
    const messages: Partial<Record<ListingAction, string>> = {
      approve: "Your listing has been approved and is now live.",
      request_changes: `A moderator asked for changes: ${input.reason}`,
      reject: `Your listing was not approved: ${input.reason}`,
      suspend: `Your listing has been suspended: ${input.reason}`,
      reinstate: "Your listing has been reinstated.",
      remove: `Your listing was removed: ${input.reason}`,
    };
    await notify(
      [{ userId: p.listerId, type: "listing.moderation", title: `Listing ${p.reference}: ${input.action.replace("_", " ")}`, body: messages[input.action] ?? "", link: `/dashboard/properties/${id}`, email: true }],
      tx,
    );
    return updated;
  });
}

export async function setAvailability(actorIn: Actor | null, id: string, availability: Availability) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  return db.$transaction(async (tx) => {
    const p = await loadManaged(actor, id, tx);
    const updated = await tx.property.update({ where: { id }, data: { availability } });
    await tx.propertyStatusHistory.create({
      data: { propertyId: id, field: "availability", fromValue: p.availability, toValue: availability, actorId: actor.id },
    });
    return updated;
  });
}

/* ---------------------------------------------------------------- Media */

export async function addImages(actorIn: Actor | null, id: string, files: File[]) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  const p = await loadManaged(actor, id);
  const existing = await db.propertyImage.count({ where: { propertyId: id } });
  if (existing + files.length > 30) throw new AppError("VALIDATION", "A listing can have up to 30 photos");
  const created = [];
  for (const [i, file] of files.entries()) {
    const stored = await storeImage(file, `properties/${p.id}`);
    created.push(
      await db.propertyImage.create({
        data: { propertyId: id, storageKey: stored.baseKey, width: stored.width, height: stored.height, sortOrder: existing + i, alt: p.title },
      }),
    );
  }
  return created.map((i) => imageDto(i, p.title));
}

export async function removeImage(actorIn: Actor | null, id: string, imageId: string) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  await loadManaged(actor, id);
  const img = await db.propertyImage.findFirst({ where: { id: imageId, propertyId: id } });
  if (!img) throw notFound("Image");
  await db.propertyImage.delete({ where: { id: imageId } });
  if (!img.storageKey.endsWith(".svg")) {
    await Promise.all([480, 960, 1600].map((w) => storage().delete(`${img.storageKey}-${w}.webp`, "public").catch(() => undefined)));
  }
}

export async function reorderImages(actorIn: Actor | null, id: string, order: string[]) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  await loadManaged(actor, id);
  await db.$transaction(order.map((imageId, i) => db.propertyImage.updateMany({ where: { id: imageId, propertyId: id }, data: { sortOrder: i } })));
}

export async function addDocument(actorIn: Actor | null, id: string, file: File, label: string, kind: string) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  await loadManaged(actor, id);
  const stored = await storePrivateDocument(file, `property-docs/${id}`);
  const doc = await db.propertyDocument.create({
    data: { propertyId: id, uploadedById: actor.id, label: label.slice(0, 120) || "Document", kind, storageKey: stored.key, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, sha256: stored.sha256 },
  });
  await db.property.update({ where: { id, documentsStatus: "NOT_SUBMITTED" }, data: { documentsStatus: "PENDING_REVIEW" } }).catch(() => undefined);
  return { id: doc.id, label: doc.label, kind: doc.kind, createdAt: doc.createdAt };
}

/**
 * Who may open a property document: the lister/owner, staff with document permission,
 * and — only for PARTIES documents — a buyer with a live offer or an applicant whose application was approved.
 */
export async function getDocumentAccessUrl(actorIn: Actor | null, documentId: string, ipHash?: string | null) {
  if (!actorIn) throw new AppError("UNAUTHENTICATED", "Please sign in to continue");
  const actor = actorIn;
  const doc = await db.propertyDocument.findUnique({ where: { id: documentId }, include: { property: { select: { ownerId: true, listerId: true } } } });
  if (!doc) throw notFound("Document");
  let allowed = isManager(actor, doc.property) || can(actor, "admin:documents.view");
  if (!allowed && doc.visibility === "PARTIES") {
    const [offer, app] = await Promise.all([
      db.offer.findFirst({
        where: { propertyId: doc.propertyId, buyerId: actor.id, status: { in: ["ACCEPTED_IN_PRINCIPLE", "PENDING_DUE_DILIGENCE", "TRANSACTION_IN_PROGRESS"] } },
        select: { id: true },
      }),
      db.rentalApplication.findFirst({ where: { propertyId: doc.propertyId, applicantId: actor.id, status: { in: ["APPROVED", "COMPLETED"] } }, select: { id: true } }),
    ]);
    allowed = !!offer || !!app;
  }
  if (!allowed) {
    await audit({ actorId: actor.id, action: "document.access_denied", targetType: "PropertyDocument", targetId: documentId, ipHash });
    throw forbidden("You do not have access to this document");
  }
  await audit({ actorId: actor.id, action: "document.access", targetType: "PropertyDocument", targetId: documentId, ipHash });
  return storage().signedUrl(doc.storageKey, 300);
}

export async function myProperties(actor: Actor) {
  return db.property.findMany({
    where: { OR: [{ listerId: actor.id }, { ownerId: actor.id }], listingStatus: { not: "REMOVED" } },
    include: { ...summaryInclude, _count: { select: { enquiries: true, savedBy: true, offers: true, applications: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getManagedProperty(actor: Actor, id: string) {
  const p = await db.property.findUnique({
    where: { id },
    include: {
      ...detailInclude,
      documents: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { profile: { select: { fullName: true } } } } } },
    },
  });
  if (!p) throw notFound("Listing");
  if (!isManager(actor, p) && !actorIsStaff(actor)) throw forbidden();
  return p;
}
