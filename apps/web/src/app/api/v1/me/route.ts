import { handler } from "@/server/http";
import { getMe, updateProfile, deactivateAccount } from "@/server/services/users";

export const GET = handler(async (ctx) => getMe(ctx.requireActor()));
export const PATCH = handler(async (ctx) => updateProfile(ctx.actor, await ctx.req.json().catch(() => ({}))));
export const DELETE = handler(async (ctx) => {
  await deactivateAccount(ctx.actor);
  return { ok: true };
});
