import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { createEnquiry } from "@/server/services/messaging";

export const POST = handler(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("enquiry", LIMITS.enquiry);
  return createEnquiry(ctx.actor, await ctx.req.json().catch(() => ({})));
});
