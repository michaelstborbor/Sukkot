import { handler } from "@/server/http";
import { actOnOffer, getOffer } from "@/server/services/offers";

export const GET = handler<{ id: string }>(async (ctx) => getOffer(ctx.actor, ctx.params.id));
export const POST = handler<{ id: string }>(async (ctx) => {
  const o = await actOnOffer(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})), ctx.ipHash);
  return { id: o.id, status: o.status };
});
