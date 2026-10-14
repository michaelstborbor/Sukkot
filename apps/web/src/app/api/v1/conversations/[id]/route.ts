import { handler } from "@/server/http";
import { getConversation } from "@/server/services/messaging";

export const GET = handler<{ id: string }>(async (ctx) => getConversation(ctx.actor, ctx.params.id, ctx.ipHash));
