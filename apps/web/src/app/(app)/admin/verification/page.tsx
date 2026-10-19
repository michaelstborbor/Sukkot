import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime, VERIFICATION_BADGES } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { PageHeader } from "@/components/dashboard/shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Verification queue" };

export default async function AdminVerificationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePagePermission("admin:verification.review", "/admin/verification");
  const { status: raw } = await searchParams;
  const status = raw === "decided" ? "decided" : "pending";
  const rows = await db.verificationRequest.findMany({
    where: status === "pending" ? { status: { in: ["PENDING_REVIEW"] } } : { status: { in: ["VERIFIED", "REJECTED", "INFO_REQUIRED", "EXPIRED"] } },
    include: {
      user: { select: { email: true, createdAt: true, profile: { select: { fullName: true } } } },
      property: { select: { id: true, title: true, reference: true } },
      documents: { select: { id: true, label: true, mimeType: true, sizeBytes: true } },
      reviewer: { select: { profile: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
    take: 50,
  });
  const year = new Date();
  year.setUTCFullYear(year.getUTCFullYear() + 1);
  return (
    <>
      <PageHeader title="Verification queue" description="Compare documents carefully. Only verify what the documents actually show." />
      <Notice className="mb-4">Opening a document is recorded in the audit log. Never download documents to personal devices.</Notice>
      <nav className="mb-4 flex gap-1">
        {(["pending", "decided"] as const).map((s) => (
          <Link key={s} href={`?status=${s}`} className={cn("rounded-full px-3 py-1 text-sm font-medium", s === status ? "bg-navy-900 text-white" : "bg-surface ring-1 ring-line")}>
            {s === "pending" ? "Waiting for review" : "Decided"}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title="Queue is empty" />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="card space-y-3 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-navy-900">{VERIFICATION_BADGES[r.kind].label}</p>
                <StatusBadge status={r.status} kind="verification" />
              </div>
              <p>
                {r.user.profile?.fullName ?? r.user.email} · {r.user.email} · member since {formatDateTime(r.user.createdAt)}
              </p>
              {r.property && (
                <p>Listing: <Link className="link" href={`/dashboard/properties/${r.property.id}?tab=documents`}>{r.property.reference} · {r.property.title}</Link></p>
              )}
              {r.notes && <p className="rounded-lg bg-canvas p-2">Applicant note: {r.notes}</p>}
              <ul className="flex flex-wrap gap-2">
                {r.documents.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/v1/verification/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border border-line px-2.5 py-1 hover:bg-navy-50">
                      {d.label} <span className="ml-1 text-muted">({Math.ceil(d.sizeBytes / 1024)} KB)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">Submitted {formatDateTime(r.createdAt)}{r.decidedAt ? ` · decided ${formatDateTime(r.decidedAt)} by ${r.reviewer?.profile?.fullName ?? "staff"}` : ""}</p>
              {r.decisionNote && <p className="text-muted">Decision note: {r.decisionNote}</p>}
              {r.status === "PENDING_REVIEW" && (
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <ActionButton path={`/admin/verification/${r.id}`} body={{ decision: "VERIFIED", expiresAt: year.toISOString() }} label="Verify (valid 1 year)" variant="secondary" reason={{ label: "What did you check?", required: true }} success="Verified" />
                  <ActionButton path={`/admin/verification/${r.id}`} body={{ decision: "INFO_REQUIRED" }} label="Ask for more information" reason={{ label: "What is missing?", required: true }} success="Applicant notified" />
                  <ActionButton path={`/admin/verification/${r.id}`} body={{ decision: "REJECTED" }} label="Reject" variant="danger" reason={{ label: "Reason", required: true }} success="Rejected" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
