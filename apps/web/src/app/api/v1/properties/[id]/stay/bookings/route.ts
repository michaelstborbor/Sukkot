import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { requestStayBooking } from "@/server/services/stays";

/** A guest asks for a stay. Staff check with the property before the guest pays. */
export const POST = handler<{ id: string }>(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("stay-request", LIMITS.stayRequest);
  const body = await ctx.req.json().catch(() => ({}));
  const b = await requestStayBooking(ctx.actor, ctx.params.id, body, ctx.ipHash);
  return { reference: b.reference, status: b.status };
});
