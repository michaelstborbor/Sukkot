import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { resetPassword } from "@/server/services/auth";

export const POST = handler(async (ctx) => {
  await ctx.limit("reset", LIMITS.passwordReset);
  await resetPassword(await ctx.req.json().catch(() => ({})));
  return { ok: true };
});
