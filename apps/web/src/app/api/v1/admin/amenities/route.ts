import { z } from "zod";
import { handler } from "@/server/http";
import { upsertAmenity } from "@/server/services/admin";

export const POST = handler(async (ctx) => {
  const input = await ctx.body(z.object({ name: z.string(), group: z.string() }));
  const a = await upsertAmenity(ctx.actor, input);
  return { id: a.id };
});
