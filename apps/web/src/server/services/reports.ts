import "server-only";
import { reportSchema, REPORT_TYPE_LABELS } from "@sukkot/shared";
import type { ReportStatus } from "@prisma/client";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";

/** Anyone may report; signed-in reporters are linked, anonymous reports need a contact email for follow-up. */
export async function createReport(actor: Actor | null, input: unknown) {
  const data = reportSchema.parse(input);
  if (!actor && !data.contactEmail) throw new AppError("VALIDATION", "Enter an email so we can follow up", { contactEmail: "Required" });
  if (data.messageId) {
    // Only someone in the conversation can attach one of its messages.
    if (!actor) throw new AppError("UNAUTHENTICATED", "Sign in to report a message");
    const msg = await db.message.findUnique({ where: { id: data.messageId }, include: { conversation: { include: { participants: true } } } });
    if (!msg || !msg.conversation.participants.some((p) => p.userId === actor.id)) throw notFound("Message");
  }
  const report = await db.report.create({
    data: {
      type: data.type,
      reporterId: actor?.id ?? null,
      contactEmail: data.contactEmail ?? null,
      propertyId: data.propertyId,
      reportedUserId: data.reportedUserId,
      messageId: data.messageId,
      reason: data.reason,
    },
  });
  // Alert moderators/support so urgent fraud reports are seen quickly.
  const staff = await db.userRoleAssignment.findMany({ where: { role: { in: ["MODERATOR", "SUPPORT", "SUPER_ADMIN"] } }, select: { userId: true }, distinct: ["userId"], take: 50 });
  await notify(staff.map((s) => ({ userId: s.userId, type: "report.new", title: `New report: ${REPORT_TYPE_LABELS[data.type]}`, body: data.reason.slice(0, 140), link: `/admin/reports?id=${report.id}` })));
  return { id: report.id };
}

export async function resolveReport(actorIn: Actor | null, id: string, input: { status: ReportStatus; resolution: string }, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:reports.handle");
  if (!input.resolution || input.resolution.trim().length < 5) throw new AppError("VALIDATION", "Describe what was done", { resolution: "Required" });
  const report = await db.report.findUnique({ where: { id } });
  if (!report) throw notFound("Report");
  const updated = await db.report.update({
    where: { id },
    data: { status: input.status, resolution: input.resolution, handlerId: actor.id, resolvedAt: ["ACTION_TAKEN", "DISMISSED", "CLOSED"].includes(input.status) ? new Date() : null },
  });
  await db.moderationAction.create({ data: { actorId: actor.id, targetType: "Report", targetId: id, action: input.status, reason: input.resolution } });
  await audit({ actorId: actor.id, action: "report.update", targetType: "Report", targetId: id, metadata: { status: input.status }, ipHash });
  if (report.reporterId) {
    await notify([{ userId: report.reporterId, type: "report.update", title: "Update on your report", body: `Status: ${input.status.replace("_", " ").toLowerCase()}. ${input.resolution}`, link: "/dashboard/notifications" }]);
  }
  return updated;
}
