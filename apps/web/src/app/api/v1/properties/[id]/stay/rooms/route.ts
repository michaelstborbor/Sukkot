import { handler } from "@/server/http";
import { refreshPublicPages } from "@/server/refresh-pages";
import { addRoomType } from "@/server/services/stays";

/** Add a room type with its prices: POST { name, roomsCount, maxAdults, nightlyPrice, ... }. */
export const POST = handler<{ id: string }>(async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const room = await addRoomType(ctx.actor, ctx.params.id, body, ctx.ipHash);
  refreshPublicPages();
  return { id: room.id };
});
