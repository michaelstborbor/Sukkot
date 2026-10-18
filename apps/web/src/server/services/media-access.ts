import "server-only";
import { db } from "../db";
import { forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor, can } from "../auth/actor";

/**
 * Who may add, reorder or remove a listing's photos and video: its lister or owner, or Sukkot Salone
 * staff while a paid inspection visit to it is booked (they take the photos on the visit), or a super
 * administrator at any time.
 */
export async function assertCanEditMedia(actorIn: Actor | null, propertyId: string) {
  const actor = assertActor(actorIn);
  const p = await db.property.findUnique({ where: { id: propertyId }, select: { id: true, title: true, listerId: true, ownerId: true } });
  if (!p) throw notFound("Listing");
  if ((actor.id === p.listerId || actor.id === p.ownerId) && can(actor, "listing:manage_own")) return { actor, property: p };
  if (can(actor, "admin:listings.edit")) return { actor, property: p };
  if (can(actor, "admin:listings.moderate")) {
    const visit = await db.siteVisit.findFirst({ where: { propertyId, status: "SCHEDULED" }, select: { id: true } });
    if (visit) return { actor, property: p };
  }
  throw forbidden("You can only manage your own listings");
}
