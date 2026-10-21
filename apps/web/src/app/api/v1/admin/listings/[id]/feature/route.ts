import { z } from "zod";
import { handler } from "@/server/http";
import { assertPermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, forbidden } from "@/server/errors";

/** Manually feature or unfeature a live listing (e.g. a complimentary promotion). */
export const POST = handler<{ id: string }>(async (ctx) => {
  const actor = assertPermission(ctx.actor, "admin:listings.moderate");
  const { featured } = await ctx.body(z.object({ featured: z.boolean() }));
  const p = await db.property.findUnique({ where: { id: ctx.params.id }, select: { listingStatus: true, listerId: true, ownerId: true } });
  if (!p || p.listingStatus !== "PUBLISHED") throw new AppError("CONFLICT", "Only live listings can be featured");
  if (p.listerId === actor.id || p.ownerId === actor.id) throw forbidden("Another moderator must feature your own listing");
  await db.property.update({ where: { id: ctx.params.id }, data: { isFeatured: featured } });
  await audit({ actorId: actor.id, action: featured ? "listing.feature" : "listing.unfeature", targetType: "Property", targetId: ctx.params.id, ipHash: ctx.ipHash });
  return { ok: true };
});
