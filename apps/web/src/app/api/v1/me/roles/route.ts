import { z } from "zod";
import { handler } from "@/server/http";
import { addSelfServiceRole } from "@/server/services/users";

export const POST = handler(async (ctx) => {
  const { role } = await ctx.body(z.object({ role: z.enum(["OWNER", "AGENT"]) }));
  await addSelfServiceRole(ctx.actor, role);
  return { ok: true };
});
