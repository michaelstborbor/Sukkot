import { handler } from "@/server/http";
import { waiveServiceFee } from "@/server/services/service-fees";

export const POST = handler<{ id: string }>(async (ctx) => waiveServiceFee(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})), ctx.ipHash));
