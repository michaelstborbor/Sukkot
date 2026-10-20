import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { quoteStay } from "@/server/services/stays";

/** The price of a stay before booking: POST { roomTypeId, checkIn, checkOut, rooms, adults, children }. */
export const POST = handler<{ id: string }>(async (ctx) => {
  await ctx.limit("stay-quote", LIMITS.stayQuote);
  const body = await ctx.req.json().catch(() => ({}));
  return quoteStay(ctx.params.id, body);
});
