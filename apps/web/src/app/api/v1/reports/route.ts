import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { createReport } from "@/server/services/reports";

export const POST = handler(async (ctx) => {
  await ctx.limit("report", LIMITS.report);
  return createReport(ctx.actor, await ctx.req.json().catch(() => ({})));
});
