import { handler } from "@/server/http";
import { actOnApplication, getApplication } from "@/server/services/applications";

export const GET = handler<{ id: string }>(async (ctx) => {
  const a = await getApplication(ctx.actor, ctx.params.id);
  const { details, ...dto } = a;
  return { ...dto, events: details.events.map((e) => ({ action: e.action, toStatus: e.toStatus, note: e.note, actorName: e.actor?.profile?.fullName ?? null, createdAt: e.createdAt })), proposedTerms: details.proposedTerms, conversationId: details.conversation?.id ?? null };
});
export const POST = handler<{ id: string }>(async (ctx) => {
  const a = await actOnApplication(ctx.actor, ctx.params.id, await ctx.req.json().catch(() => ({})));
  return { id: a.id, status: a.status };
});
