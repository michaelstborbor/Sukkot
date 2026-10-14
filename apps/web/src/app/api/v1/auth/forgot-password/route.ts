import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { requestPasswordReset } from "@/server/services/auth";

export const POST = handler(async (ctx) => {
  await ctx.limit("reset", LIMITS.passwordReset);
  await requestPasswordReset(await ctx.req.json().catch(() => ({})));
  return { ok: true, message: "If an account exists for that email, we've sent a reset link." };
});
