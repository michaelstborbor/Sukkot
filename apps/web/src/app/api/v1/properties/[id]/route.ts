import { handler } from "@/server/http";
import { notFound } from "@/server/errors";
import { getPropertyDetail, recordView, updateProperty } from "@/server/services/properties";
import { refreshPublicPages } from "@/server/refresh-pages";

export const GET = handler<{ id: string }>(async (ctx) => {
  const p = await getPropertyDetail(ctx.params.id, ctx.actor);
  if (!p) throw notFound("Listing");
  if (p.listingStatus === "PUBLISHED" && ctx.req.nextUrl.searchParams.get("view") === "1") await recordView(p.id).catch(() => undefined);
  return p;
});

export const PATCH = handler<{ id: string }>(async (ctx) => {
  const p = await updateProperty(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})), ctx.ipHash);
  refreshPublicPages();
  return { id: p.id, slug: p.slug };
});
