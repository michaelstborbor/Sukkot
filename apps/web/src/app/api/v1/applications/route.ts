import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { createApplication, listApplications } from "@/server/services/applications";

export const GET = handler(async (ctx) => ({ items: await listApplications(ctx.actor) }));
export const POST = handler(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("offer", LIMITS.offer);
  const a = await createApplication(ctx.actor, await ctx.req.json().catch(() => ({})));
  return { id: a.id, status: a.status };
});
