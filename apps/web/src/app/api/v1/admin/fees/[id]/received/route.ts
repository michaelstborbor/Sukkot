import { handler } from "@/server/http";
import { recordServiceFeeReceived } from "@/server/services/service-fees";

export const POST = handler<{ id: string }>(async (ctx) => recordServiceFeeReceived(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})), ctx.ipHash));
