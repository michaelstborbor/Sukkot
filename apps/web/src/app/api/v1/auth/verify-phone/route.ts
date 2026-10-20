import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { verifyPhoneCode } from "@/server/services/auth";

/** Confirm the phone number with the code that was texted to it. */
export const POST = handler(async (ctx) => {
  const actor = ctx.requireActor();
  await ctx.limit("phone-code-check", LIMITS.phoneCodeCheck);
  return verifyPhoneCode(actor.id, await ctx.req.json().catch(() => ({})));
});
