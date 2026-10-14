import { z } from "zod";
import { handler } from "@/server/http";
import { confirmRecordedPayment } from "@/server/payments";

export const POST = handler<{ id: string }>(async (ctx) => {
  const { confirm } = await ctx.body(z.object({ confirm: z.boolean() }));
  return confirmRecordedPayment(ctx.actor, ctx.params.id, confirm);
});
