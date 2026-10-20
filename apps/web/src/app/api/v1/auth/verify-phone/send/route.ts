import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { sendPhoneCode } from "@/server/services/auth";

/** Text the signed-in person a code to confirm their phone number, optionally a new number. */
export const POST = handler(async (ctx) => {
  const actor = ctx.requireActor();
  const body = (await ctx.req.json().catch(() => ({}))) as { phone?: unknown };
  await ctx.limit("phone-code", LIMITS.phoneCode);
  return sendPhoneCode(actor.id, body.phone);
});
