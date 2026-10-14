import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime, REPORT_TYPE_LABELS } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { PageHeader } from "@/components/dashboard/shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePagePermission("admin:reports.handle", "/admin/reports");
  const { view } = await searchParams;
  const open = view !== "closed";
  const rows = await db.report.findMany({
    where: { status: open ? { in: ["OPEN", "INVESTIGATING"] } : { in: ["ACTION_TAKEN", "DISMISSED", "CLOSED"] } },
    include: {
      reporter: { select: { email: true, profile: { select: { fullName: true } } } },
      reportedUser: { select: { id: true, email: true, status: true, profile: { select: { fullName: true } } } },
      property: { select: { id: true, title: true, reference: true, slug: true } },
      message: { select: { id: true, body: true, conversationId: true, hiddenAt: true } },
      handler: { select: { profile: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: open ? "asc" : "desc" },
    take: 50,
  });
  return (
    <>
      <PageHeader title="Reports" description="Fraud, misleading listings, abuse and support requests from users." />
      <nav className="mb-4 flex gap-1">
        {[["open", "Open"], ["closed", "Closed"]].map(([k, l]) => (
          <Link key={k} href={`?view=${k}`} className={cn("rounded-full px-3 py-1 text-sm font-medium", (k === "open") === open ? "bg-navy-900 text-white" : "bg-white ring-1 ring-line")}>{l}</Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title="No reports" />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="card space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-navy-900">{REPORT_TYPE_LABELS[r.type]}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="whitespace-pre-wrap">{r.reason}</p>
              <p className="text-muted">
                From {r.reporter ? `${r.reporter.profile?.fullName ?? ""} (${r.reporter.email})` : r.contactEmail ?? "anonymous visitor"} · {formatDateTime(r.createdAt)}
              </p>
              {r.property && <p>Listing: <Link className="link" href={`/admin/listings?q=${r.property.reference}&status=PUBLISHED`}>{r.property.reference} · {r.property.title}</Link></p>}
              {r.reportedUser && <p>User: <Link className="link" href={`/admin/users?q=${encodeURIComponent(r.reportedUser.email)}`}>{r.reportedUser.profile?.fullName ?? r.reportedUser.email}</Link> ({r.reportedUser.status.toLowerCase()})</p>}
              {r.message && (
                <div className="rounded-lg bg-canvas p-2">
                  <p className="text-xs text-muted">Reported message{r.message.hiddenAt ? " (hidden)" : ""}</p>
                  <p>{r.message.body}</p>
                  <div className="mt-2 flex gap-2">
                    <Link className="link text-xs" href={`/dashboard/messages/${r.message.conversationId}`}>Open conversation (audited)</Link>
                    {!r.message.hiddenAt && <ActionButton path={`/admin/messages/${r.message.id}/hide`} label="Hide message" variant="ghost" reason={{ label: "Reason", required: true }} success="Message hidden" />}
                  </div>
                </div>
              )}
              {r.resolution && <p className="text-muted">Resolution: {r.resolution} ({r.handler?.profile?.fullName ?? "staff"})</p>}
              {open && (
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {r.status === "OPEN" && <ActionButton path={`/admin/reports/${r.id}`} body={{ status: "INVESTIGATING", resolution: "" }} label="Start investigating" success="Updated" />}
                  <ActionButton path={`/admin/reports/${r.id}`} body={{ status: "ACTION_TAKEN" }} reasonKey="resolution" label="Action taken" variant="secondary" reason={{ label: "What action was taken?", required: true }} success="Report closed" />
                  <ActionButton path={`/admin/reports/${r.id}`} body={{ status: "DISMISSED" }} reasonKey="resolution" label="Dismiss" variant="ghost" reason={{ label: "Why is no action needed?", required: true }} success="Report dismissed" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
