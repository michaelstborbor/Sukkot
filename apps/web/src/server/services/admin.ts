import "server-only";
import { parseMajorToMinor, slugify, type Role } from "@sukkot/shared";
import { z } from "zod";
import type { LocationLevel, Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { destroyAllSessions } from "../auth/session";

export async function adminOverview() {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [users, newUsers, published, pending, openReports, verificationQueue, enquiries30, payments] = await Promise.all([
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.property.count({ where: { listingStatus: "PUBLISHED" } }),
    db.property.count({ where: { listingStatus: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    db.verificationRequest.count({ where: { status: "PENDING_REVIEW" } }),
    db.enquiry.count({ where: { createdAt: { gte: since } } }),
    db.paymentTransaction.groupBy({ by: ["status"], _count: true, where: { createdAt: { gte: since } } }),
  ]);
  const byCategory = await db.property.groupBy({ by: ["category"], where: { listingStatus: "PUBLISHED" }, _count: true });
  return { users, newUsers, published, pending, openReports, verificationQueue, enquiries30, payments, byCategory };
}

const roleSchema = z.object({ role: z.enum(["USER", "OWNER", "AGENT", "SUPER_ADMIN", "MODERATOR", "VERIFICATION_OFFICER", "SUPPORT", "FINANCE"]), grant: z.boolean() });

export async function setUserRole(actorIn: Actor | null, userId: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:roles.assign");
  const { role, grant } = roleSchema.parse(input);
  if (userId === actor.id && role === "SUPER_ADMIN" && !grant) throw forbidden("You cannot remove your own super administrator role");
  if (grant) {
    await db.userRoleAssignment.upsert({ where: { userId_role: { userId, role } }, create: { userId, role, grantedById: actor.id }, update: {} });
  } else {
    await db.userRoleAssignment.deleteMany({ where: { userId, role } });
  }
  await audit({ actorId: actor.id, action: grant ? "role.grant" : "role.revoke", targetType: "User", targetId: userId, metadata: { role }, ipHash });
}

export async function setUserStatus(actorIn: Actor | null, userId: string, input: { status: "ACTIVE" | "SUSPENDED"; reason: string }, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:users.manage");
  if (userId === actor.id) throw forbidden("You cannot change your own status");
  if (!input.reason || input.reason.length < 5) throw new AppError("VALIDATION", "Give a reason", { reason: "Required" });
  const target = await db.user.findUnique({ where: { id: userId }, include: { roles: true } });
  if (!target) throw notFound("User");
  if (target.roles.some((r) => r.role === "SUPER_ADMIN") && !actor.roles.includes("SUPER_ADMIN")) throw forbidden();
  await db.user.update({ where: { id: userId }, data: { status: input.status, suspendedReason: input.status === "SUSPENDED" ? input.reason : null } });
  if (input.status === "SUSPENDED") {
    await destroyAllSessions(userId);
    await db.property.updateMany({ where: { listerId: userId, listingStatus: "PUBLISHED" }, data: { listingStatus: "SUSPENDED" } });
  }
  await db.moderationAction.create({ data: { actorId: actor.id, targetType: "User", targetId: userId, action: input.status, reason: input.reason } });
  await audit({ actorId: actor.id, action: `user.${input.status.toLowerCase()}`, targetType: "User", targetId: userId, metadata: { reason: input.reason }, ipHash });
}

export async function searchUsers(q: string | undefined, page = 1) {
  const where: Prisma.UserWhereInput = q
    ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { profile: { fullName: { contains: q, mode: "insensitive" } } }, { phone: { contains: q } }] }
    : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, include: { profile: true, roles: true, _count: { select: { listedProperties: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25 }),
  ]);
  return { total, users };
}

/* -------------------------------------------------------------- Locations */

const locationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  /** TOWN is stored as a CITY-level place that is not flagged as a city. */
  level: z.enum(["PROVINCE", "DISTRICT", "CITY", "TOWN", "LOCALITY"]),
  parentId: z.string().min(1),
  latitude: z.coerce.number().min(6.8).max(10.1).optional(),
  longitude: z.coerce.number().min(-13.4).max(-10.2).optional(),
});

const PARENT_LEVEL: Record<string, LocationLevel> = { PROVINCE: "COUNTRY", DISTRICT: "PROVINCE", CITY: "DISTRICT", TOWN: "DISTRICT", LOCALITY: "CITY" };

export async function createLocation(actorIn: Actor | null, input: unknown) {
  const actor = assertPermission(actorIn, "admin:locations.manage");
  const data = locationSchema.parse(input);
  const parent = await db.location.findUnique({ where: { id: data.parentId } });
  if (!parent || parent.level !== PARENT_LEVEL[data.level]) throw new AppError("VALIDATION", "Choose a valid parent location", { parentId: "Invalid parent" });
  let slug = slugify(data.name);
  if (await db.location.findUnique({ where: { slug } })) slug = slugify(`${data.name}-${parent.name}`);
  const level = data.level === "TOWN" ? "CITY" : data.level;
  const loc = await db.location.create({ data: { name: data.name, slug, level, isCity: data.level === "CITY", parentId: parent.id, pathIds: [], latitude: data.latitude, longitude: data.longitude } });
  await db.location.update({ where: { id: loc.id }, data: { pathIds: [...parent.pathIds, loc.id] } });
  await audit({ actorId: actor.id, action: "location.create", targetType: "Location", targetId: loc.id, metadata: { name: data.name } });
  return loc;
}

export async function setLocationActive(actorIn: Actor | null, id: string, isActive: boolean) {
  const actor = assertPermission(actorIn, "admin:locations.manage");
  await db.location.update({ where: { id }, data: { isActive } });
  await audit({ actorId: actor.id, action: isActive ? "location.activate" : "location.deactivate", targetType: "Location", targetId: id });
}

/* ---------------------------------------------------------------- Catalog */

export async function upsertAmenity(actorIn: Actor | null, input: { name: string; group: string }) {
  const actor = assertPermission(actorIn, "admin:catalog.manage");
  const name = z.string().trim().min(2).max(60).parse(input.name);
  const group = z.string().trim().min(2).max(40).parse(input.group);
  const a = await db.amenity.upsert({ where: { slug: slugify(name) }, create: { name, slug: slugify(name), group }, update: { name, group, isActive: true } });
  await audit({ actorId: actor.id, action: "amenity.upsert", targetType: "Amenity", targetId: a.id });
  return a;
}

const planSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/),
  name: z.string().trim().min(2).max(60),
  audience: z.enum(["LANDLORD", "AGENT", "AGENCY"]),
  description: z.string().trim().min(5).max(500),
  /** Major units as typed by staff, e.g. "250" or "250.50". */
  price: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  currency: z.enum(["SLE", "USD"]),
  periodDays: z.coerce.number().int().min(1).max(366),
  maxListings: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : v), z.coerce.number().int().min(1).max(10000).nullable()),
  featuredSlots: z.coerce.number().int().min(0).max(100),
  features: z.array(z.string().trim().min(2).max(120)).max(12),
  isActive: z.boolean(),
});

export async function upsertPlan(actorIn: Actor | null, input: unknown) {
  const actor = assertPermission(actorIn, "admin:plans.manage");
  const { price, ...rest } = planSchema.parse(input);
  const priceMinor = price === "0" || price === "" ? 0n : parseMajorToMinor(price, rest.currency);
  if (priceMinor === null) throw new AppError("VALIDATION", "Enter a valid price", { price: "Invalid amount" });
  const data = { ...rest, priceMinor };
  const plan = await db.subscriptionPlan.upsert({ where: { code: data.code }, create: data, update: data });
  await audit({ actorId: actor.id, action: "plan.upsert", targetType: "SubscriptionPlan", targetId: plan.id, metadata: { price: priceMinor.toString(), currency: data.currency } });
  return plan;
}

export const ADMIN_ROLES_ASSIGNABLE: Role[] = ["OWNER", "AGENT", "MODERATOR", "VERIFICATION_OFFICER", "SUPPORT", "FINANCE", "SUPER_ADMIN"];
