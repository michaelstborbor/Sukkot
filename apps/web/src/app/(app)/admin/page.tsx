import type { Metadata } from "next";
import { PROPERTY_CATEGORY_LABELS } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { adminOverview } from "@/server/services/admin";
import { PageHeader } from "@/components/dashboard/shell";
import { Stat } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminPage() {
  await requirePagePermission("admin:access", "/admin");
  const o = await adminOverview();
  const paid = o.payments.find((p) => p.status === "SUCCEEDED")?._count ?? 0;
  const failed = o.payments.filter((p) => ["FAILED", "DISPUTED"].includes(p.status)).reduce((n, p) => n + p._count, 0);
  return (
    <>
      <PageHeader title="Administration" description="Platform health over the last 30 days." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active users" value={o.users} hint={`${o.newUsers} new`} href="/admin/users" />
        <Stat label="Live listings" value={o.published} href="/admin/listings?status=PUBLISHED" />
        <Stat label="Awaiting moderation" value={o.pending} href="/admin/listings" />
        <Stat label="Verification queue" value={o.verificationQueue} href="/admin/verification" />
        <Stat label="Open reports" value={o.openReports} href="/admin/reports" />
        <Stat label="Enquiries (30 days)" value={o.enquiries30} />
        <Stat label="Provider-confirmed payments" value={paid} href="/admin/payments" />
        <Stat label="Failed or disputed payments" value={failed} href="/admin/payments?status=DISPUTED" />
      </div>
      <section className="card mt-6 p-5">
        <h2 className="mb-3 font-bold text-navy-900">Live listings by category</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          {o.byCategory.map((c) => (
            <li key={c.category} className="flex justify-between rounded-lg bg-canvas px-3 py-2">
              <span>{PROPERTY_CATEGORY_LABELS[c.category]}</span>
              <strong>{c._count}</strong>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
