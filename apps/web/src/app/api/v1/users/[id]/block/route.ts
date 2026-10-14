import { handler } from "@/server/http";
import { blockUser, unblockUser } from "@/server/services/messaging";

export const POST = handler<{ id: string }>(async (ctx) => {
  await blockUser(ctx.actor, ctx.params.id);
  return { ok: true };
});
export const DELETE = handler<{ id: string }>(async (ctx) => {
  await unblockUser(ctx.actor, ctx.params.id);
  return { ok: true };
});
