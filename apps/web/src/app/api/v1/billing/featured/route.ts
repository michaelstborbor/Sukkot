import { z } from "zod";
import { handler } from "@/server/http";
import { spendFeaturedSlot } from "@/server/services/billing";
import { refreshPublicPages } from "@/server/refresh-pages";

export const POST = handler(async (ctx) => {
  const { propertyId } = await ctx.body(z.object({ propertyId: z.string().min(1).max(40) }));
  const result = await spendFeaturedSlot(ctx.actor, propertyId, ctx.ipHash);
  refreshPublicPages();
  return result;
});
