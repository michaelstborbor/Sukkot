import { z } from "zod";
import { handler } from "@/server/http";
import { setLocationActive } from "@/server/services/admin";

export const PATCH = handler<{ id: string }>(async (ctx) => {
  const { isActive } = await ctx.body(z.object({ isActive: z.boolean() }));
  await setLocationActive(ctx.actor, ctx.params.id, isActive);
  return { ok: true };
});
