import { z } from "zod";
import { AVAILABILITY } from "@sukkot/shared";
import { handler } from "@/server/http";
import { ownerListingAction, setAvailability } from "@/server/services/properties";
import { refreshPublicPages } from "@/server/refresh-pages";

const schema = z.union([
  z.object({ action: z.enum(["submit", "pause", "resume", "remove"]) }),
  z.object({ availability: z.enum(AVAILABILITY) }),
]);

export const POST = handler<{ id: string }>(async (ctx) => {
  const input = await ctx.body(schema);
  const p = "action" in input ? await ownerListingAction(ctx.actor, ctx.params.id, input.action) : await setAvailability(ctx.actor, ctx.params.id, input.availability);
  refreshPublicPages();
  return { id: p.id, listingStatus: p.listingStatus, availability: p.availability };
});
