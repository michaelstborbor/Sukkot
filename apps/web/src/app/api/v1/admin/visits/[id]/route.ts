import { z } from "zod";
import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import { refreshPublicPages } from "@/server/refresh-pages";
import { cancelVisit, completeVisit, scheduleVisit } from "@/server/services/site-visits";

/** Staff book, complete or cancel a paid inspection visit: POST { action, ...fields }. */
export const POST = handler<{ id: string }>(async (ctx) => {
  const body = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const { action } = z.object({ action: z.enum(["schedule", "complete", "cancel"]) }).parse(body);
  if (action === "schedule") return scheduleVisit(ctx.actor, ctx.params.id, body, ctx.ipHash);
  if (action === "cancel") return cancelVisit(ctx.actor, ctx.params.id, body, ctx.ipHash);
  if (action === "complete") {
    const visit = await completeVisit(ctx.actor, ctx.params.id, body, ctx.ipHash);
    refreshPublicPages();
    return visit;
  }
  throw new AppError("BAD_REQUEST", "Unknown action");
});
