import { moderationSchema } from "@sukkot/shared";
import { handler } from "@/server/http";
import { z } from "zod";
import { deleteListingPermanently, moderateListing } from "@/server/services/properties";
import { refreshPublicPages } from "@/server/refresh-pages";

export const POST = handler<{ id: string }>(async (ctx) => {
  const input = await ctx.body(moderationSchema);
  const p = await moderateListing(ctx.actor, ctx.params.id, input, ctx.ipHash);
  refreshPublicPages();
  return { id: p.id, listingStatus: p.listingStatus, documentsStatus: p.documentsStatus, isFeatured: p.isFeatured };
});

/** Delete a listing for good (super administrators only). */
export const DELETE = handler<{ id: string }>(async (ctx) => {
  const input = await ctx.body(z.object({ reason: z.string().trim().max(500).optional() }));
  const result = await deleteListingPermanently(ctx.actor, ctx.params.id, input.reason, ctx.ipHash);
  refreshPublicPages();
  return result;
});
