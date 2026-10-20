import { handler } from "@/server/http";
import { requestPhotoShoot } from "@/server/services/site-visits";

/** The lister asks Sukkot Salone to take the listing's photos and video: POST { contactPhone, note? }. */
export const POST = handler<{ id: string }>(async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const visit = await requestPhotoShoot(ctx.actor, ctx.params.id, body, ctx.ipHash);
  return { id: visit.id, status: visit.status };
});
