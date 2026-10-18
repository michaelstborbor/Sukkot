import { z } from "zod";
import { handler } from "@/server/http";
import { deleteSavedSearch, saveSearch, setSearchAlerts } from "@/server/services/favorites";

export const POST = handler(async (ctx) => {
  const { name, queryString } = await ctx.body(z.object({ name: z.string().min(1).max(120), queryString: z.string().max(1000) }));
  const s = await saveSearch(ctx.actor, name, queryString);
  return { id: s.id };
});
export const DELETE = handler(async (ctx) => {
  await deleteSavedSearch(ctx.actor, ctx.req.nextUrl.searchParams.get("id") ?? "");
  return { ok: true };
});
export const PATCH = handler(async (ctx) => {
  const { id, alertsOn } = await ctx.body(z.object({ id: z.string().min(1).max(64), alertsOn: z.boolean() }));
  return setSearchAlerts(ctx.actor, id, alertsOn);
});
