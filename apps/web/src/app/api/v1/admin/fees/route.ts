import { handler } from "@/server/http";
import { raiseServiceFee } from "@/server/services/service-fees";

export const POST = handler(async (ctx) => raiseServiceFee(ctx.actor, await ctx.req.json().catch(() => ({})), ctx.ipHash));
