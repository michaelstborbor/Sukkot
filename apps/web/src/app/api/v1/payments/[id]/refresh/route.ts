import { handler } from "@/server/http";
import { refreshPaymentStatus } from "@/server/payments";

export const POST = handler<{ id: string }>(async (ctx) => refreshPaymentStatus(ctx.actor, ctx.params.id));
