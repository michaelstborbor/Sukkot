import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { emailSchema, phoneSchema, slugify } from "@sukkot/shared";
import { db } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";

const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

export const agencySchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: opt(2000),
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  email: emailSchema.optional().or(z.literal("").transform(() => undefined)),
  website: z.string().url().max(200).optional().or(z.literal("").transform(() => undefined)),
  address: opt(300),
  registrationNumber: opt(120),
});

export async function myAgency(actor: Actor) {
  const m = await db.agencyMember.findFirst({
    where: { userId: actor.id },
    include: {
      agency: {
        include: {
          members: { include: { user: { select: { id: true, email: true, profile: { select: { fullName: true } } } } }, orderBy: { createdAt: "asc" } },
          _count: { select: { properties: { where: { listingStatus: "PUBLISHED" } } } },
        },
      },
    },
  });
  return m ? { role: m.role, agency: m.agency } : null;
}

async function requireAgencyAdmin(actor: Actor) {
  const m = await db.agencyMember.findFirst({ where: { userId: actor.id } });
  if (!m) throw notFound("Agency");
  if (m.role === "AGENT") throw forbidden("Only agency owners and managers can do this");
  return m;
}

export async function createAgency(actorIn: Actor | null, input: unknown) {
  const actor = assertPermission(actorIn, "agency:manage");
  const data = agencySchema.parse(input);
  if (await db.agencyMember.findFirst({ where: { userId: actor.id } })) throw new AppError("CONFLICT", "You already belong to an agency");
  const base = slugify(data.name).slice(0, 60) || "agency";
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const agency = await db.agency.create({ data: { ...data, slug, members: { create: { userId: actor.id, role: "OWNER" } } } });
      await audit({ actorId: actor.id, action: "agency.create", targetType: "Agency", targetId: agency.id });
      return agency;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new AppError("CONFLICT", "Choose a different agency name");
}

export async function updateAgency(actorIn: Actor | null, input: unknown) {
  const actor = assertPermission(actorIn, "agency:manage");
  const m = await requireAgencyAdmin(actor);
  const data = agencySchema.parse(input);
  return db.agency.update({ where: { id: m.agencyId }, data });
}

/** Add an existing agent account to the agency by email. */
export async function addAgencyMember(actorIn: Actor | null, input: unknown) {
  const actor = assertPermission(actorIn, "agency:manage");
  const m = await requireAgencyAdmin(actor);
  const { email, role } = z.object({ email: emailSchema, role: z.enum(["MANAGER", "AGENT"]).default("AGENT") }).parse(input);
  const user = await db.user.findUnique({ where: { email }, include: { roles: true } });
  if (!user || !user.roles.some((r) => r.role === "AGENT")) {
    throw new AppError("VALIDATION", "No agent account uses that email. Ask them to sign up and choose “I'm an agent” first.", { email: "Not an agent account" });
  }
  if (await db.agencyMember.findFirst({ where: { userId: user.id } })) throw new AppError("CONFLICT", "That agent already belongs to an agency");
  await db.agencyMember.create({ data: { agencyId: m.agencyId, userId: user.id, role } });
  const agency = await db.agency.findUnique({ where: { id: m.agencyId }, select: { name: true } });
  await notify([{ userId: user.id, type: "agency.added", title: `You were added to ${agency?.name}`, body: "You can now list properties on behalf of this agency.", link: "/dashboard/agency" }]);
  await audit({ actorId: actor.id, action: "agency.member_add", targetType: "Agency", targetId: m.agencyId, metadata: { userId: user.id, role } });
  return { ok: true };
}

export async function removeAgencyMember(actorIn: Actor | null, memberId: string) {
  const actor = assertPermission(actorIn, "agency:manage");
  const m = await requireAgencyAdmin(actor);
  const target = await db.agencyMember.findUnique({ where: { id: memberId } });
  if (!target || target.agencyId !== m.agencyId) throw notFound("Member");
  if (target.role === "OWNER") throw forbidden("The agency owner cannot be removed");
  await db.agencyMember.delete({ where: { id: memberId } });
  await audit({ actorId: actor.id, action: "agency.member_remove", targetType: "Agency", targetId: m.agencyId, metadata: { userId: target.userId } });
  return { ok: true };
}
