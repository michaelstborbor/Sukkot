import { handler } from "@/server/http";
import { recordPayment } from "@/server/payments";

export const POST = handler(async (ctx) => recordPayment(ctx.actor, await ctx.req.json().catch(() => ({}))));
