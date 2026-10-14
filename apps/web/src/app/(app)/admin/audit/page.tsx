import type { Metadata } from "next";
import { formatDateTime } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { PageHeader } from "@/components/dashboard/shell";
import { Pagination } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  await requirePagePermission("admin:audit.view", "/admin/audit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.action ? { action: { startsWith: sp.action } } : {};
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, include: { actor: { select: { email: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
  ]);
  return (
    <>
      <PageHeader title="Audit log" description="Sensitive actions: moderation, verification, role changes, document access, settings. Entries cannot be edited." />
      <form className="mb-4"><input name="action" defaultValue={sp.action} placeholder="Filter by action, e.g. document." aria-label="Filter by action" className="h-9 w-full max-w-sm rounded-lg border border-line px-3 text-sm" /></form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted uppercase">
              <th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 align-top last:border-0">
                <td className="p-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                <td className="p-3">{r.actor?.email ?? "system"}</td>
                <td className="p-3 font-mono text-xs">{r.action}</td>
                <td className="p-3 text-xs">{r.targetType ? `${r.targetType} ${r.targetId ?? ""}` : ""}</td>
                <td className="max-w-xs p-3 font-mono text-xs break-all text-muted">{r.metadata ? JSON.stringify(r.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / 50)} hrefFor={(p) => `?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), page: String(p) })}`} />
    </>
  );
}
