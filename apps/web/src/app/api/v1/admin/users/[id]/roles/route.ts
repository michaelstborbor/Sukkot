import { handler } from "@/server/http";
import { setUserRole } from "@/server/services/admin";

export const POST = handler<{ id: string }>(async (ctx) => {
  await setUserRole(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})), ctx.ipHash);
  return { ok: true };
});
