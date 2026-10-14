import { handler } from "@/server/http";
import { actOnInspection } from "@/server/services/inspections";

export const POST = handler<{ id: string }>(async (ctx) => {
  const i = await actOnInspection(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})));
  return { id: i.id, status: i.status, scheduledAt: i.scheduledAt };
});
