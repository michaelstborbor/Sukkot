import { handler } from "@/server/http";
import { upsertPlan } from "@/server/services/admin";

export const POST = handler(async (ctx) => {
  const p = await upsertPlan(ctx.actor, await ctx.req.json().catch(() => ({})));
  return { id: p.id };
});
