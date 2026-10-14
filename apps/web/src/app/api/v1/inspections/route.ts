import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { listInspections, requestInspection } from "@/server/services/inspections";

export const GET = handler(async (ctx) => ({ items: await listInspections(ctx.actor) }));
export const POST = handler(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("enquiry", LIMITS.enquiry);
  const i = await requestInspection(ctx.actor, await ctx.req.json().catch(() => ({})));
  return { id: i.id, status: i.status };
});
