import { handler } from "@/server/http";
import { refreshPublicPages } from "@/server/refresh-pages";
import { removeRoomType, updateRoomType } from "@/server/services/stays";

/** Change a room type: PATCH with the whole room. New prices apply to new bookings only. */
export const PATCH = handler<{ id: string; roomId: string }>(async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const room = await updateRoomType(ctx.actor, ctx.params.id, ctx.params.roomId, body, ctx.ipHash);
  refreshPublicPages();
  return { id: room.id };
});

/** Remove a room type, or switch it off when it has bookings. */
export const DELETE = handler<{ id: string; roomId: string }>(async (ctx) => {
  const result = await removeRoomType(ctx.actor, ctx.params.id, ctx.params.roomId, ctx.ipHash);
  refreshPublicPages();
  return result;
});
