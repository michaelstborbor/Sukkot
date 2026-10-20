import { z } from "zod";
import { handler } from "@/server/http";
import { suggestListingNearby } from "@/server/services/search-alerts";

export const POST = handler(async (ctx) => {
  await ctx.limit("suggest", { limit: 10, window: 3600 });
  const { propertyId } = await ctx.body(z.object({ propertyId: z.string().min(1).max(40) }));
  return suggestListingNearby(ctx.actor, propertyId, ctx.ipHash);
});
