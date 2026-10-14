import { handler } from "@/server/http";
import { reviewManualPayment } from "@/server/payments";

export const POST = handler<{ id: string }>(async (ctx) => reviewManualPayment(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})), ctx.ipHash));
