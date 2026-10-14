import type { Metadata } from "next";
import { formatDate } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Agencies" };

export default async function AdminAgenciesPage() {
  await requirePagePermission("admin:users.manage", "/admin/agencies");
  const rows = await db.agency.findMany({
    include: { _count: { select: { members: true, properties: true } }, verifications: { where: { status: "VERIFIED" }, select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Agencies" />
      {rows.length === 0 ? (
        <EmptyState title="No agencies yet" />
      ) : (
        <ul className="card divide-y divide-line text-sm">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="font-semibold">{a.name} {a.isDemo && <Badge tone="warning">Demo</Badge>} {a.verifications.length > 0 && <Badge tone="verified">Verified</Badge>}</p>
                <p className="text-muted">{a.registrationNumber ? `Reg. ${a.registrationNumber} · ` : ""}{a.email ?? ""} {a.phone ?? ""}</p>
              </div>
              <p className="text-muted">{a._count.members} members · {a._count.properties} listings · since {formatDate(a.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
