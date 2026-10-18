import { handler } from "@/server/http";
import { recordPlatformRefund } from "@/server/payments";

export const POST = handler<{ id: string }>(async (ctx) => recordPlatformRefund(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})), ctx.ipHash));
