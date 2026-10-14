import { parseSearchParams } from "@sukkot/shared";
import { handler } from "@/server/http";
import { createProperty, searchProperties } from "@/server/services/properties";

export const GET = handler(async (ctx) => searchProperties(parseSearchParams(ctx.req.nextUrl.searchParams)));

export const POST = handler(async (ctx) => {
  const p = await createProperty(ctx.actor, await ctx.req.json().catch(() => ({})));
  return { id: p.id, reference: p.reference, slug: p.slug };
});
