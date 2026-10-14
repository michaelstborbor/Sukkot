import "server-only";
import { db } from "../db";
import { assertActor } from "../auth/actor";
import type { Actor } from "../auth/session";

/** Tenancies where the actor is the tenant or the landlord, with the rent schedule. */
export async function listTenancies(actorIn: Actor | null) {
  const actor = assertActor(actorIn);
  const rows = await db.tenancy.findMany({
    where: { OR: [{ tenantId: actor.id }, { landlordId: actor.id }] },
    include: {
      property: { select: { id: true, title: true, slug: true, reference: true } },
      tenant: { select: { id: true, profile: { select: { fullName: true } } } },
      landlord: { select: { id: true, profile: { select: { fullName: true } } } },
      schedule: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { startDate: "desc" },
  });
  return rows.map((t) => ({ ...t, myRole: t.landlordId === actor.id ? ("LANDLORD" as const) : ("TENANT" as const) }));
}
