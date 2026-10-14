import { handler } from "@/server/http";
import { createLocation } from "@/server/services/admin";

export const POST = handler(async (ctx) => {
  const l = await createLocation(ctx.actor, await ctx.req.json().catch(() => ({})));
  return { id: l.id, slug: l.slug };
});
