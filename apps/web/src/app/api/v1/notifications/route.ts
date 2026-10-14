import { z } from "zod";
import { handler } from "@/server/http";
import { listNotifications, markNotificationsRead } from "@/server/services/notifications";

export const GET = handler(async (ctx) => ({ items: await listNotifications(ctx.actor) }));
export const POST = handler(async (ctx) => {
  const { ids } = await ctx.body(z.object({ ids: z.array(z.string()).max(200).optional() }));
  await markNotificationsRead(ctx.actor, ids);
  return { ok: true };
});
