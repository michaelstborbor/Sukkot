import "server-only";
import { db } from "../db";
import { notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor } from "../auth/actor";
import { summaryInclude, toSummary } from "./properties";

export async function toggleFavorite(actorIn: Actor | null, propertyId: string, save: boolean) {
  const actor = assertActor(actorIn);
  const property = await db.property.findUnique({ where: { id: propertyId }, select: { id: true, listingStatus: true } });
  if (!property || property.listingStatus !== "PUBLISHED") throw notFound("Listing");
  const key = { userId_propertyId: { userId: actor.id, propertyId } };
  const existing = await db.savedProperty.findUnique({ where: key });
  if (save && !existing) {
    await db.$transaction([
      db.savedProperty.create({ data: { userId: actor.id, propertyId } }),
      db.property.update({ where: { id: propertyId }, data: { saveCount: { increment: 1 } } }),
    ]);
  } else if (!save && existing) {
    await db.$transaction([
      db.savedProperty.delete({ where: key }),
      db.property.update({ where: { id: propertyId }, data: { saveCount: { decrement: 1 } } }),
    ]);
  }
  return { saved: save };
}

export async function listFavorites(actorIn: Actor | null) {
  const actor = assertActor(actorIn);
  const rows = await db.savedProperty.findMany({
    where: { userId: actor.id, property: { listingStatus: "PUBLISHED" } },
    include: { property: { include: summaryInclude } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => toSummary(r.property));
}

export async function savedIds(actorId: string | undefined, ids: string[]) {
  if (!actorId || !ids.length) return new Set<string>();
  const rows = await db.savedProperty.findMany({ where: { userId: actorId, propertyId: { in: ids } }, select: { propertyId: true } });
  return new Set(rows.map((r) => r.propertyId));
}

export async function saveSearch(actorIn: Actor | null, name: string, queryString: string) {
  const actor = assertActor(actorIn);
  const count = await db.savedSearch.count({ where: { userId: actor.id } });
  if (count >= 20) await db.savedSearch.deleteMany({ where: { id: (await db.savedSearch.findFirst({ where: { userId: actor.id }, orderBy: { createdAt: "asc" } }))!.id } });
  return db.savedSearch.create({ data: { userId: actor.id, name: name.slice(0, 80), queryString: queryString.slice(0, 1000) } });
}

export async function deleteSavedSearch(actorIn: Actor | null, id: string) {
  const actor = assertActor(actorIn);
  await db.savedSearch.deleteMany({ where: { id, userId: actor.id } });
}
