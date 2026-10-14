import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { sendMessage } from "@/server/services/messaging";

export const POST = handler<{ id: string }>(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("message", LIMITS.message);
  return sendMessage(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})));
});
