import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { myVerifications, submitVerification } from "@/server/services/verification";

export const GET = handler(async (ctx) => ({ items: await myVerifications(ctx.actor) }));
export const POST = handler(async (ctx) => {
  ctx.requireActor();
  await ctx.limit("upload", LIMITS.upload);
  const form = await ctx.req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const labels = form.getAll("labels").map(String);
  const fields = { kind: form.get("kind"), propertyId: form.get("propertyId") || undefined, notes: form.get("notes") || undefined };
  const r = await submitVerification(ctx.actor, fields, files.map((file, i) => ({ file, label: labels[i] ?? file.name })));
  return { id: r.id, status: r.status };
});
