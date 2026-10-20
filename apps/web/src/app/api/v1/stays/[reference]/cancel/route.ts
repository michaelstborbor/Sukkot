import { handler } from "@/server/http";
import { cancelStayByGuest } from "@/server/services/stays";

/** The guest cancels their booking: POST { reason? }. */
export const POST = handler<{ reference: string }>(async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  return cancelStayByGuest(ctx.actor, ctx.params.reference, body, ctx.ipHash);
});
