import { z } from "zod";
import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import {
  cancelStayByStaff,
  confirmStayBooking,
  markStayUnavailable,
  recordStayOutcome,
  recordStayPayout,
  recordStayRefund,
  setStayRoom,
} from "@/server/services/stays";

/** Staff work on a booking: POST { action, ...fields }. */
export const POST = handler<{ id: string }>(async (ctx) => {
  const body = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const { action } = z.object({ action: z.enum(["confirm", "unavailable", "cancel", "room", "outcome", "payout", "refund"]) }).parse(body);
  const id = ctx.params.id;
  if (action === "confirm") return confirmStayBooking(ctx.actor, id, body, ctx.ipHash);
  if (action === "unavailable") return markStayUnavailable(ctx.actor, id, body, ctx.ipHash);
  if (action === "cancel") return cancelStayByStaff(ctx.actor, id, body, ctx.ipHash);
  if (action === "room") return setStayRoom(ctx.actor, id, body, ctx.ipHash);
  if (action === "outcome") return recordStayOutcome(ctx.actor, id, body, ctx.ipHash);
  if (action === "payout") return recordStayPayout(ctx.actor, id, body, ctx.ipHash);
  if (action === "refund") return recordStayRefund(ctx.actor, id, body, ctx.ipHash);
  throw new AppError("BAD_REQUEST", "Unknown action");
});
