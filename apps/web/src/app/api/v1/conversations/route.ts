import { handler } from "@/server/http";
import { listConversations } from "@/server/services/messaging";

export const GET = handler(async (ctx) => ({ items: await listConversations(ctx.actor) }));
