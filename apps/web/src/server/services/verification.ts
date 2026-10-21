import "server-only";
import { verificationDecisionSchema, verificationSubmitSchema, VERIFICATION_BADGES } from "@sukkot/shared";
import { db } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor, assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";
import { storage } from "../storage";
import { storePrivateDocument } from "../uploads";

/**
 * Evidence-based verification. Submitting documents only puts a request in the queue; a badge
 * appears only after an authorised officer marks it VERIFIED with a written reason.
 */
export async function submitVerification(actorIn: Actor | null, fields: unknown, files: { label: string; file: File }[]) {
  const actor = assertActor(actorIn);
  const data = verificationSubmitSchema.parse(fields);
  if (!files.length) throw new AppError("VALIDATION", "Attach at least one document");
  if (files.length > 5) throw new AppError("VALIDATION", "Attach up to 5 documents");
  if (data.kind === "AGENT_CREDENTIALS" && !actor.roles.includes("AGENT")) throw forbidden("Only agent accounts can request agent verification");
  const aboutListing = data.kind === "LISTING_AUTHORITY" || data.kind === "PROPERTY_DOCUMENTS";
  if (aboutListing && !data.propertyId) throw new AppError("VALIDATION", "Choose the listing", { propertyId: "Required" });
  // A listing can only be attached to a listing check, and only by its lister or owner: the decision is written to that listing.
  if (!aboutListing && data.propertyId) throw new AppError("VALIDATION", "This check is not about a listing", { propertyId: "Not allowed" });
  if (data.propertyId) {
    const p = await db.property.findUnique({ where: { id: data.propertyId }, select: { listerId: true, ownerId: true } });
    if (!p || (p.listerId !== actor.id && p.ownerId !== actor.id)) throw notFound("Listing");
  }
  if (data.agencyId) {
    const member = await db.agencyMember.findUnique({ where: { agencyId_userId: { agencyId: data.agencyId, userId: actor.id } }, select: { id: true } });
    if (!member) throw notFound("Agency");
  }
  const open = await db.verificationRequest.findFirst({
    where: { userId: actor.id, kind: data.kind, propertyId: data.propertyId ?? null, status: { in: ["PENDING_REVIEW", "INFO_REQUIRED"] } },
  });
  const stored = [];
  for (const f of files) stored.push({ label: f.label.slice(0, 120) || "Document", ...(await storePrivateDocument(f.file, `verification/${actor.id}`)) });
  const request = open
    ? await db.verificationRequest.update({
        where: { id: open.id },
        data: { status: "PENDING_REVIEW", notes: data.notes ?? open.notes, documents: { create: stored.map((s) => ({ label: s.label, storageKey: s.key, mimeType: s.mimeType, sizeBytes: s.sizeBytes, sha256: s.sha256 })) } },
      })
    : await db.verificationRequest.create({
        data: {
          userId: actor.id,
          kind: data.kind,
          propertyId: data.propertyId,
          agencyId: data.agencyId,
          notes: data.notes,
          documents: { create: stored.map((s) => ({ label: s.label, storageKey: s.key, mimeType: s.mimeType, sizeBytes: s.sizeBytes, sha256: s.sha256 })) },
        },
      });
  if (data.propertyId) {
    const field = data.kind === "LISTING_AUTHORITY" ? "authorityStatus" : "documentsStatus";
    await db.property.update({ where: { id: data.propertyId }, data: { [field]: "PENDING_REVIEW" } });
  }
  await audit({ actorId: actor.id, action: "verification.submit", targetType: "VerificationRequest", targetId: request.id, metadata: { kind: data.kind } });
  return request;
}

export async function decideVerification(actorIn: Actor | null, id: string, input: unknown, ipHash?: string | null) {
  const actor = assertPermission(actorIn, "admin:verification.review");
  const data = verificationDecisionSchema.parse(input);
  const req = await db.verificationRequest.findUnique({ where: { id } });
  if (!req) throw notFound("Verification request");
  if (req.userId === actor.id) throw forbidden("You cannot review your own verification");
  return db.$transaction(async (tx) => {
    const updated = await tx.verificationRequest.update({
      where: { id },
      data: { status: data.decision, reviewerId: actor.id, decisionNote: data.reason, decidedAt: new Date(), expiresAt: data.expiresAt ?? null },
    });
    if (req.propertyId) {
      const field = req.kind === "LISTING_AUTHORITY" ? "authorityStatus" : "documentsStatus";
      await tx.property.update({ where: { id: req.propertyId }, data: { [field]: data.decision } });
    }
    await tx.moderationAction.create({ data: { actorId: actor.id, targetType: "VerificationRequest", targetId: id, action: data.decision, reason: data.reason } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: `verification.${data.decision.toLowerCase()}`, targetType: "VerificationRequest", targetId: id, metadata: { kind: req.kind }, ipHash } });
    const label = VERIFICATION_BADGES[req.kind].label;
    const body =
      data.decision === "VERIFIED" ? `Your ${label} check is complete.` : data.decision === "INFO_REQUIRED" ? `We need more information: ${data.reason}` : `Your verification was not approved: ${data.reason}`;
    await notify([{ userId: req.userId, type: "verification.decision", title: `Verification update: ${label}`, body, link: "/dashboard/verification", email: true }], tx);
    return updated;
  });
}

/** Verification officers view documents through short-lived signed URLs; each view is audited. */
export async function verificationDocumentUrl(actorIn: Actor | null, documentId: string, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const doc = await db.verificationDocument.findUnique({ where: { id: documentId }, include: { request: { select: { userId: true } } } });
  if (!doc) throw notFound("Document");
  const isOwner = doc.request.userId === actor.id;
  if (!isOwner) assertPermission(actor, "admin:documents.view");
  await audit({ actorId: actor.id, action: "verification.document_view", targetType: "VerificationDocument", targetId: documentId, ipHash });
  return storage().signedUrl(doc.storageKey, 300);
}

export async function myVerifications(actorIn: Actor | null) {
  const actor = assertActor(actorIn);
  return db.verificationRequest.findMany({
    where: { userId: actor.id },
    include: { documents: { select: { id: true, label: true, createdAt: true } }, property: { select: { title: true, reference: true } } },
    orderBy: { createdAt: "desc" },
  });
}
