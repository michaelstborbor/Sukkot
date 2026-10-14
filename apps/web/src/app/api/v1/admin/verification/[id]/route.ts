import { handler } from "@/server/http";
import { decideVerification } from "@/server/services/verification";

export const POST = handler<{ id: string }>(async (ctx) => {
  const r = await decideVerification(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})), ctx.ipHash);
  return { id: r.id, status: r.status };
});
