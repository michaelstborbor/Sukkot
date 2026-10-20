import { handler } from "@/server/http";
import { refreshPublicPages } from "@/server/refresh-pages";
import { arrangeStay } from "@/server/services/stays";

/** Staff open or close bookings for a listing by agreement with its management: POST { open, commissionPercent? }. */
export const POST = handler<{ id: string }>(async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const result = await arrangeStay(ctx.actor, ctx.params.id, body, ctx.ipHash);
  refreshPublicPages();
  return result;
});
