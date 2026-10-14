import { z } from "zod";
import { handler } from "@/server/http";
import { spendFeaturedSlot } from "@/server/services/billing";

export const POST = handler(async (ctx) => {
  const { propertyId } = await ctx.body(z.object({ propertyId: z.string().min(1).max(40) }));
  return spendFeaturedSlot(ctx.actor, propertyId, ctx.ipHash);
});
