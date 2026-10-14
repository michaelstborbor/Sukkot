import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { submitManualPlatformPayment } from "@/server/payments";

export const POST = handler(async (ctx) => {
  await ctx.limit("manual-payment", LIMITS.manualPayment);
  return submitManualPlatformPayment(ctx.actor, await ctx.req.json().catch(() => ({})));
});
