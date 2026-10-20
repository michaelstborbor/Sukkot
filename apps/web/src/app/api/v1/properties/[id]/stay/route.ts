import { handler } from "@/server/http";
import { refreshPublicPages } from "@/server/refresh-pages";
import { getStaySetup, saveStayDetails } from "@/server/services/stays";

/** A listing's booking set-up: what kind of stay it is, its rooms and whether it takes bookings. */
export const GET = handler<{ id: string }>(async (ctx) => getStaySetup(ctx.actor, ctx.params.id));

/** Save the kind of stay, check-in times, cancellation policy and facilities: PUT { kind, ... }. */
export const PUT = handler<{ id: string }>(async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const saved = await saveStayDetails(ctx.actor, ctx.params.id, body, ctx.ipHash);
  refreshPublicPages();
  return saved;
});
