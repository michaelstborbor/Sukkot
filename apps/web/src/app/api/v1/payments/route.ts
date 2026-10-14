import { handler } from "@/server/http";
import { initiatePayment, listMyPayments } from "@/server/payments";

export const GET = handler(async (ctx) => ({ items: await listMyPayments(ctx.actor) }));
export const POST = handler(async (ctx) => initiatePayment(ctx.actor, await ctx.req.json().catch(() => ({}))));
