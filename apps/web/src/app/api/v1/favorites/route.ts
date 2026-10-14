import { z } from "zod";
import { handler } from "@/server/http";
import { listFavorites, toggleFavorite } from "@/server/services/favorites";

export const GET = handler(async (ctx) => ({ items: await listFavorites(ctx.actor) }));
export const POST = handler(async (ctx) => {
  const { propertyId, save } = await ctx.body(z.object({ propertyId: z.string().min(1), save: z.boolean() }));
  return toggleFavorite(ctx.actor, propertyId, save);
});
