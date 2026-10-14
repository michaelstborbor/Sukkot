import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import { LIMITS } from "@/server/rate-limit";
import { updateAvatar } from "@/server/services/users";

export const POST = handler(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("upload", LIMITS.upload);
  const form = await ctx.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose an image");
  return updateAvatar(ctx.actor, file);
});
