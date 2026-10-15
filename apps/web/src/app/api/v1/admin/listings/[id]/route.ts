import { moderationSchema } from "@sukkot/shared";
import { handler } from "@/server/http";
import { moderateListing } from "@/server/services/properties";
import { refreshPublicPages } from "@/server/refresh-pages";

export const POST = handler<{ id: string }>(async (ctx) => {
  const input = await ctx.body(moderationSchema);
  const p = await moderateListing(ctx.actor, ctx.params.id, input, ctx.ipHash);
  refreshPublicPages();
  return { id: p.id, listingStatus: p.listingStatus, documentsStatus: p.documentsStatus, isFeatured: p.isFeatured };
});
