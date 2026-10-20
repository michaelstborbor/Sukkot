import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { exportReport } from "@/server/services/data-reports";

/** Download a users or listings report as CSV. The filters are the query string of the admin screen. */
export const GET = handler(async (ctx) => {
  const actor = ctx.requireActor();
  await ctx.limit("data-report", LIMITS.dataReport);
  const { filename, csv } = await exportReport(actor, Object.fromEntries(ctx.req.nextUrl.searchParams.entries()), ctx.ipHash);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
