import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { resendEmailVerification } from "@/server/services/auth";

/** Email the signed-in person a new confirmation link. */
export const POST = handler(async (ctx) => {
  const actor = ctx.requireActor();
  await ctx.limit("verify-resend", LIMITS.verifyResend);
  return resendEmailVerification(actor.id);
});
