import { handler } from "@/server/http";
import { updateDueDiligenceItem } from "@/server/services/offers";

export const PATCH = handler<{ id: string }>(async (ctx) => {
  const i = await updateDueDiligenceItem(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})));
  return { id: i.id, status: i.status };
});
