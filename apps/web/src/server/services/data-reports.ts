import "server-only";
import {
  CURRENCIES,
  LISTING_PURPOSES,
  LISTING_PURPOSE_LABELS,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  minorToMajorString,
  parseMajorToMinor,
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABELS,
  RENTAL_PERIOD_LABELS,
  ROLE_LABELS,
  ROLES,
  VERIFICATION_STATUS_LABELS,
} from "@sukkot/shared";
import type { ListerCapacity, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { AppError, forbidden, unauthenticated, zodFields } from "../errors";
import type { Actor } from "../auth/session";
import { can } from "../auth/actor";
import { audit } from "../audit";
import { env } from "../env";

/**
 * Data reports for staff: pick users or listings, filter them, look at the first rows and download
 * them as a CSV file. Every download is recorded in the audit log.
 */

/** The most rows one download holds. Narrow the filters to get the rest. */
export const REPORT_ROW_LIMIT = 10_000;
export const PREVIEW_ROWS = 20;

export const DATASETS = ["users", "listings"] as const;
export type Dataset = (typeof DATASETS)[number];
export const DATASET_LABELS: Record<Dataset, string> = { users: "Users", listings: "Listings" };

/** Lister roles as the search filters group them: owners (and developers) and agents acting for someone. */
const LISTER_CAPACITIES: Record<"OWNER" | "AGENT", ListerCapacity[]> = {
  OWNER: ["OWNER", "DEVELOPER"],
  AGENT: ["AGENT_FOR_OWNER", "AGENT_FOR_DEVELOPER", "OTHER_AUTHORISED"],
};
const CAPACITY_LABELS: Record<ListerCapacity, string> = {
  OWNER: "Owner",
  DEVELOPER: "Developer",
  AGENT_FOR_OWNER: "Agent for the owner",
  AGENT_FOR_DEVELOPER: "Agent for a developer",
  OTHER_AUTHORISED: "Other authorised person",
};

// Form fields arrive as strings, empty when not set.
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v), schema.optional());
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date such as 2026-01-31").refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}, "Not a real date");
const yesNo = z.enum(["yes", "no"]);
const amount = z.string().max(20).refine((s) => parseMajorToMinor(s) !== null, "Enter an amount such as 25000");
const id = z.string().max(40);

const userFilters = z.object({
  dataset: z.literal("users"),
  role: optional(z.enum(ROLES)),
  status: optional(z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"])),
  emailConfirmed: optional(yesNo),
  joinedFrom: optional(day),
  joinedTo: optional(day),
  q: optional(z.string().max(200)),
});

const listingFilters = z.object({
  dataset: z.literal("listings"),
  status: optional(z.enum(LISTING_STATUSES)),
  purpose: optional(z.enum(LISTING_PURPOSES)),
  category: optional(z.enum(PROPERTY_CATEGORIES)),
  typeId: optional(id),
  locationId: optional(id),
  currency: optional(z.enum(CURRENCIES)),
  minPrice: optional(amount),
  maxPrice: optional(amount),
  listedBy: optional(z.enum(["OWNER", "AGENT"])),
  featured: optional(yesNo),
  createdFrom: optional(day),
  createdTo: optional(day),
  q: optional(z.string().max(200)),
});

export const reportFiltersSchema = z.discriminatedUnion("dataset", [userFilters, listingFilters]);
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type UserReportFilters = z.infer<typeof userFilters>;
export type ListingReportFilters = z.infer<typeof listingFilters>;

/** Users need the permission that guards user management; listings that of listing moderation or user management. */
export function datasetsFor(actor: Actor | null): Dataset[] {
  return DATASETS.filter((d) => (d === "users" ? can(actor, "admin:users.manage") : can(actor, "admin:listings.moderate") || can(actor, "admin:users.manage")));
}

/** Listers' private phone and email go only to staff who already see them on the moderation screen. */
export function canSeePrivateContacts(actor: Actor | null) {
  return can(actor, "admin:listings.moderate");
}

function authorise(actor: Actor | null, input: unknown) {
  if (!actor) throw unauthenticated();
  if (datasetsFor(actor).length === 0) throw forbidden();
  const parsed = reportFiltersSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION", "Please check the filters", zodFields(parsed.error));
  if (!datasetsFor(actor).includes(parsed.data.dataset)) throw forbidden();
  return { actor, filters: parsed.data };
}

// Dates are taken as whole days in Freetown time, which is GMT all year. "To" includes the whole day.
const startOf = (d: string) => new Date(`${d}T00:00:00.000Z`);
const endOf = (d: string) => new Date(startOf(d).getTime() + 86400_000);
function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: startOf(from) } : {}), ...(to ? { lt: endOf(to) } : {}) };
}

function userWhere(f: UserReportFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  if (f.role) and.push({ roles: { some: { role: f.role } } });
  if (f.status) and.push({ status: f.status });
  if (f.emailConfirmed) and.push({ emailVerifiedAt: f.emailConfirmed === "yes" ? { not: null } : null });
  const joined = dateRange(f.joinedFrom, f.joinedTo);
  if (joined) and.push({ createdAt: joined });
  if (f.q) and.push({ OR: [{ email: { contains: f.q, mode: "insensitive" } }, { profile: { fullName: { contains: f.q, mode: "insensitive" } } }, { phone: { contains: f.q.replace(/[\s-]/g, "") } }, { profile: { whatsapp: { contains: f.q.replace(/[\s-]/g, "") } } }] });
  return { AND: and };
}

function listingWhere(f: ListingReportFilters): Prisma.PropertyWhereInput {
  const and: Prisma.PropertyWhereInput[] = [];
  if (f.status) and.push({ listingStatus: f.status });
  if (f.purpose) and.push({ purpose: f.purpose });
  if (f.category) and.push({ category: f.category });
  if (f.typeId) and.push({ propertyTypeId: f.typeId });
  if (f.locationId) and.push({ locationPathIds: { has: f.locationId } });
  if (f.minPrice || f.maxPrice) {
    // Prices are compared in one currency only: Leones unless another is chosen.
    const currency = f.currency ?? "SLE";
    const min = f.minPrice ? parseMajorToMinor(f.minPrice, currency) : null;
    const max = f.maxPrice ? parseMajorToMinor(f.maxPrice, currency) : null;
    and.push({ currency, priceMinor: { ...(min !== null ? { gte: min } : {}), ...(max !== null ? { lte: max } : {}) } });
  } else if (f.currency) and.push({ currency: f.currency });
  if (f.listedBy) and.push({ listerCapacity: { in: LISTER_CAPACITIES[f.listedBy] } });
  if (f.featured) and.push({ isFeatured: f.featured === "yes" });
  const created = dateRange(f.createdFrom, f.createdTo);
  if (created) and.push({ createdAt: created });
  if (f.q) and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { reference: { contains: f.q, mode: "insensitive" } }] });
  return { AND: and };
}

/** "2026-01-31 14:05", in Freetown time (GMT). */
const when = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");
const yes = (b: boolean) => (b ? "Yes" : "No");
/** "UNDER_OFFER" or "month" → "Under offer", "Month". */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ");

const USER_COLUMNS = ["User ID", "Name", "Email", "Email confirmed", "Phone", "Phone confirmed", "WhatsApp", "Account types", "Status", "Suspension reason", "Demo account", "Listings", "Published listings", "Joined", "Last sign-in"];

async function userRows(f: UserReportFilters, take: number) {
  const where = userWhere(f);
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        phone: true,
        phoneVerifiedAt: true,
        status: true,
        suspendedReason: true,
        isDemo: true,
        createdAt: true,
        lastLoginAt: true,
        profile: { select: { fullName: true, whatsapp: true } },
        roles: { select: { role: true } },
        _count: { select: { listedProperties: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take,
    }),
  ]);
  const published = users.length
    ? await db.property.groupBy({ by: ["listerId"], where: { listerId: { in: users.map((u) => u.id) }, listingStatus: "PUBLISHED" }, _count: true })
    : [];
  const publishedBy = new Map(published.map((p) => [p.listerId, p._count]));
  const rows = users.map((u) => [
    u.id,
    u.profile?.fullName ?? "",
    u.email,
    yes(!!u.emailVerifiedAt),
    u.phone ?? "",
    yes(!!u.phoneVerifiedAt),
    u.profile?.whatsapp ?? "",
    ROLES.filter((r) => u.roles.some((x) => x.role === r)).map((r) => ROLE_LABELS[r]).join("; "),
    sentence(u.status),
    u.suspendedReason ?? "",
    yes(u.isDemo),
    String(u._count.listedProperties),
    String(publishedBy.get(u.id) ?? 0),
    when(u.createdAt),
    when(u.lastLoginAt),
  ]);
  return { columns: USER_COLUMNS, rows, total };
}

const LISTING_COLUMNS = ["Reference", "Title", "Status", "Purpose", "Category", "Property type", "Price", "Currency", "Rental period", "Bedrooms", "Bathrooms", "Location", "Area", "Availability", "Featured", "Listed by", "Lister name", "Lister email", "Agency", "Documents", "Views", "Saves", "Enquiries", "Created", "Published", "Expires", "Link"];
const PRIVATE_COLUMNS = ["Private contact phone", "Private contact email"];

async function listingRows(f: ListingReportFilters, take: number, withPrivate: boolean) {
  const where = listingWhere(f);
  const [total, listings] = await Promise.all([
    db.property.count({ where }),
    db.property.findMany({
      where,
      select: {
        reference: true,
        slug: true,
        title: true,
        listingStatus: true,
        purpose: true,
        category: true,
        propertyTypeOther: true,
        priceMinor: true,
        currency: true,
        rentalPeriod: true,
        bedrooms: true,
        bathrooms: true,
        availability: true,
        isFeatured: true,
        listerCapacity: true,
        documentsStatus: true,
        viewCount: true,
        saveCount: true,
        enquiryCount: true,
        createdAt: true,
        publishedAt: true,
        expiresAt: true,
        // Selected only for staff allowed to see them, so they never leave the database otherwise.
        privateContactPhone: withPrivate,
        privateContactEmail: withPrivate,
        propertyType: { select: { name: true } },
        location: { select: { name: true, parent: { select: { name: true } } } },
        lister: { select: { email: true, profile: { select: { fullName: true } } } },
        agency: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take,
    }),
  ]);
  const rows = listings.map((p) => [
    p.reference,
    p.title,
    LISTING_STATUS_LABELS[p.listingStatus],
    LISTING_PURPOSE_LABELS[p.purpose],
    PROPERTY_CATEGORY_LABELS[p.category],
    p.propertyTypeOther ? `${p.propertyType.name}: ${p.propertyTypeOther}` : p.propertyType.name,
    minorToMajorString(p.priceMinor, p.currency),
    p.currency,
    p.rentalPeriod ? sentence(RENTAL_PERIOD_LABELS[p.rentalPeriod]) : "",
    p.bedrooms?.toString() ?? "",
    p.bathrooms?.toString() ?? "",
    p.location.name,
    p.location.parent?.name ?? "",
    sentence(p.availability),
    yes(p.isFeatured),
    CAPACITY_LABELS[p.listerCapacity],
    p.lister.profile?.fullName ?? "",
    p.lister.email,
    p.agency?.name ?? "",
    VERIFICATION_STATUS_LABELS[p.documentsStatus],
    String(p.viewCount),
    String(p.saveCount),
    String(p.enquiryCount),
    when(p.createdAt),
    when(p.publishedAt),
    when(p.expiresAt),
    `${env.appUrl}/properties/${p.slug}`,
    ...(withPrivate ? [p.privateContactPhone ?? "", p.privateContactEmail ?? ""] : []),
  ]);
  return { columns: withPrivate ? [...LISTING_COLUMNS, ...PRIVATE_COLUMNS] : LISTING_COLUMNS, rows, total };
}

function run(actor: Actor, filters: ReportFilters, take: number) {
  return filters.dataset === "users" ? userRows(filters, take) : listingRows(filters, take, canSeePrivateContacts(actor));
}

/** The first rows of a report and how many rows match in all, for the admin screen. */
export async function previewReport(actorIn: Actor | null, input: unknown) {
  const { actor, filters } = authorise(actorIn, input);
  const result = await run(actor, filters, PREVIEW_ROWS);
  return { ...result, filters };
}

/** The whole report (up to REPORT_ROW_LIMIT rows) as a CSV file. Records the download in the audit log. */
export async function exportReport(actorIn: Actor | null, input: unknown, ipHash?: string | null) {
  const { actor, filters } = authorise(actorIn, input);
  const { columns, rows, total } = await run(actor, filters, REPORT_ROW_LIMIT);
  const { dataset, ...applied } = filters;
  await audit({
    actorId: actor.id,
    action: "data_report.download",
    targetType: "DataReport",
    targetId: dataset,
    metadata: { dataset, filters: applied, rows: rows.length, total, privateContacts: dataset === "listings" && canSeePrivateContacts(actor) },
    ipHash,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return { filename: `sukkot-${dataset}-${stamp}.csv`, csv: toCsv([columns, ...rows]), rows: rows.length, total };
}

/**
 * One CSV cell. Text starting with = + - @ (or a tab or carriage return) is prefixed with a single quote
 * so spreadsheet programs show it as text instead of running it as a formula.
 */
export function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows as CSV, with a byte order mark so Excel reads the text as UTF-8. */
export function toCsv(rows: string[][]) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** The query string for a report's filters, without empty values: shared by the screen and the download link. */
export function reportQuery(filters: Record<string, string | undefined>) {
  return new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1])).toString();
}
