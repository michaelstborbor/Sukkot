import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import { LIMITS } from "@/server/rate-limit";
import { addDocument } from "@/server/services/properties";

export const POST = handler<{ id: string }>(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("upload", LIMITS.upload);
  const form = await ctx.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a file");
  const label = String(form.get("label") ?? "Document");
  const kind = String(form.get("kind") ?? "OTHER").replace(/[^A-Z_]/g, "").slice(0, 30) || "OTHER";
  return addDocument(ctx.actor, ctx.params.id, file, label, kind);
});
