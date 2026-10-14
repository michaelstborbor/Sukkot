import { z } from "zod";
import { handler } from "@/server/http";
import { hideMessage } from "@/server/services/messaging";

export const POST = handler<{ id: string }>(async (ctx) => {
  const { reason } = await ctx.body(z.object({ reason: z.string().min(5).max(500) }));
  await hideMessage(ctx.actor, ctx.params.id, reason);
  return { ok: true };
});
