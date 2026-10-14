import { z } from "zod";
import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import { LIMITS } from "@/server/rate-limit";
import { addImages, removeImage, reorderImages } from "@/server/services/properties";

export const POST = handler<{ id: string }>(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("upload", LIMITS.upload);
  const form = await ctx.req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) throw new AppError("VALIDATION", "Choose at least one photo");
  if (files.length > 10) throw new AppError("VALIDATION", "Upload up to 10 photos at a time");
  return { images: await addImages(ctx.actor, ctx.params.id, files) };
});

export const PUT = handler<{ id: string }>(async (ctx) => {
  const { order } = await ctx.body(z.object({ order: z.array(z.string()).max(30) }));
  await reorderImages(ctx.actor, ctx.params.id, order);
  return { ok: true };
});

export const DELETE = handler<{ id: string }>(async (ctx) => {
  const imageId = ctx.req.nextUrl.searchParams.get("imageId");
  if (!imageId) throw new AppError("BAD_REQUEST", "imageId is required");
  await removeImage(ctx.actor, ctx.params.id, imageId);
  return { ok: true };
});
