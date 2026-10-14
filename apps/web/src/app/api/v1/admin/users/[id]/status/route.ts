import { z } from "zod";
import { handler } from "@/server/http";
import { setUserStatus } from "@/server/services/admin";

export const POST = handler<{ id: string }>(async (ctx) => {
  const input = await ctx.body(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().max(1000) }));
  await setUserStatus(ctx.actor, ctx.params.id, input, ctx.ipHash);
  return { ok: true };
});
