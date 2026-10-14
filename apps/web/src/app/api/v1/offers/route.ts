import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { createOffer, listOffers } from "@/server/services/offers";

export const GET = handler(async (ctx) => ({ items: await listOffers(ctx.actor) }));
export const POST = handler(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("offer", LIMITS.offer);
  const o = await createOffer(ctx.actor, await ctx.req.json().catch(() => ({})));
  return { id: o.id, status: o.status };
});
