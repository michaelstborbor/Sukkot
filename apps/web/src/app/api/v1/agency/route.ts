import { handler } from "@/server/http";
import { createAgency, updateAgency } from "@/server/services/agency";

export const POST = handler(async (ctx) => {
  const a = await createAgency(ctx.actor, await ctx.req.json().catch(() => ({})));
  return { id: a.id };
});
export const PATCH = handler(async (ctx) => {
  const a = await updateAgency(ctx.actor, await ctx.req.json().catch(() => ({})));
  return { id: a.id };
});
