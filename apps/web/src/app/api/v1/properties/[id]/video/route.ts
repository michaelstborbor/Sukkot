import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import { LIMITS } from "@/server/rate-limit";
import { refreshPublicPages } from "@/server/refresh-pages";
import { getOwnListingVideo, removeListingVideo, uploadListingVideo, videoDto } from "@/server/services/video";

/** The lister polls this while their video converts. */
export const GET = handler<{ id: string }>(async (ctx) => {
  return { video: videoDto(await getOwnListingVideo(ctx.actor, ctx.params.id)) };
});

export const POST = handler<{ id: string }>(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("upload", LIMITS.upload);
  const form = await ctx.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a video");
  return { video: await uploadListingVideo(ctx.actor, ctx.params.id, file) };
});

export const DELETE = handler<{ id: string }>(async (ctx) => {
  await removeListingVideo(ctx.actor, ctx.params.id);
  refreshPublicPages();
  return { ok: true };
});
