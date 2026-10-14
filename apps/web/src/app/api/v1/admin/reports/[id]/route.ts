import { z } from "zod";
import { handler } from "@/server/http";
import { resolveReport } from "@/server/services/reports";

export const POST = handler<{ id: string }>(async (ctx) => {
  const input = await ctx.body(z.object({ status: z.enum(["OPEN", "INVESTIGATING", "ACTION_TAKEN", "DISMISSED", "CLOSED"]), resolution: z.string().max(2000) }));
  const r = await resolveReport(ctx.actor, ctx.params.id, input, ctx.ipHash);
  return { id: r.id, status: r.status };
});
