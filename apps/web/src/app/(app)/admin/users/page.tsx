import type { Metadata } from "next";
import { formatDate, ROLE_LABELS } from "@sukkot/shared";
import { requirePagePermission, can } from "@/server/auth/actor";
import { ADMIN_ROLES_ASSIGNABLE, searchUsers } from "@/server/services/admin";
import { PageHeader } from "@/components/dashboard/shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge, Pagination } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const actor = await requirePagePermission("admin:users.manage", "/admin/users");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { total, users } = await searchUsers(sp.q?.trim() || undefined, page);
  const canAssign = can(actor, "admin:roles.assign");
  return (
    <>
      <PageHeader title="Users" description={`${total} accounts`} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" aria-label="Search users" className="h-10 w-full max-w-sm rounded-lg border border-line px-3 text-sm" />
      </form>
      <ul className="space-y-3">
        {users.map((u) => {
          const roles = u.roles.map((r) => r.role);
          return (
            <li key={u.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{u.profile?.fullName ?? u.email} {u.isDemo && <Badge tone="warning">Demo</Badge>}</p>
                  <p className="text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""} · joined {formatDate(u.createdAt)} · {u._count.listedProperties} listings</p>
                </div>
                <StatusBadge status={u.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{roles.map((r) => <Badge key={r}>{ROLE_LABELS[r]}</Badge>)}</div>
              {u.suspendedReason && <p className="mt-2 text-danger">Suspended: {u.suspendedReason}</p>}
              {u.id !== actor.id && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-emerald-700">Manage</summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {u.status === "ACTIVE" ? (
                      <ActionButton path={`/admin/users/${u.id}/status`} body={{ status: "SUSPENDED" }} label="Suspend account" variant="danger" reason={{ label: "Reason (shown to the user)", required: true }} success="Account suspended" />
                    ) : (
                      <ActionButton path={`/admin/users/${u.id}/status`} body={{ status: "ACTIVE" }} label="Reactivate" reason={{ label: "Reason", required: true }} success="Account reactivated" />
                    )}
                    {canAssign &&
                      ADMIN_ROLES_ASSIGNABLE.map((r) => (
                        <ActionButton
                          key={r}
                          path={`/admin/users/${u.id}/roles`}
                          body={{ role: r, grant: !roles.includes(r) }}
                          label={`${roles.includes(r) ? "Remove" : "Grant"} ${ROLE_LABELS[r].toLowerCase()}`}
                          variant="ghost"
                          confirm={r === "SUPER_ADMIN" ? "Super administrators have full access to the platform." : undefined}
                          success="Roles updated"
                        />
                      ))}
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      <Pagination page={page} totalPages={Math.ceil(total / 25)} hrefFor={(p) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </>
  );
}
