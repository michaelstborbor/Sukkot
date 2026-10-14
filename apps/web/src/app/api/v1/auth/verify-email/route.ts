import { z } from "zod";
import { handler } from "@/server/http";
import { verifyEmail } from "@/server/services/auth";

export const POST = handler(async (ctx) => {
  const { token } = await ctx.body(z.object({ token: z.string().min(20).max(200) }));
  await verifyEmail(token);
  return { ok: true };
});
