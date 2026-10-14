import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { formatDate, formatMoney, minorToMajorString, NOTICES, RENTAL_PERIOD_LABELS } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { listTenancies } from "@/server/services/tenancies";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { RecordPaymentButton } from "@/components/dashboard/record-payment";
import { EmptyState, Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Tenancies" };

const PURPOSES = [
  { value: "RENT", label: "Rent" },
  { value: "DEPOSIT", label: "Security deposit" },
  { value: "OTHER", label: "Other" },
];

export default async function TenanciesPage() {
  const actor = await requirePageActor("/dashboard/tenancies");
  const rows = await listTenancies(actor);
  const today = new Date();
  return (
    <>
      <PageHeader title="Tenancies" description="Tenancy records and rent schedules. Payments are made directly between tenant and landlord and recorded here." />
      <Notice className="mb-6">{NOTICES.noEscrow}</Notice>
      {rows.length === 0 ? (
        <EmptyState icon={<KeyRound className="h-6 w-6" />} title="No tenancies" body="A tenancy record is created when a landlord records the start of a lease from an approved application." />
      ) : (
        <div className="space-y-6">
          {rows.map((t) => {
            const nextDue = t.schedule.find((s) => !s.settledAt);
            const overdue = t.schedule.filter((s) => !s.settledAt && s.dueDate < today);
            const other = t.myRole === "LANDLORD" ? t.tenant.profile?.fullName : t.landlord.profile?.fullName;
            return (
              <section key={t.id} className="card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      {overdue.length > 0 && <StatusBadge status="OVERDUE" />}
                    </div>
                    <Link href={`/properties/${t.property.slug}`} className="mt-1 block font-semibold text-navy-900 hover:underline">{t.property.title}</Link>
                    <p className="text-sm text-muted">
                      {t.myRole === "LANDLORD" ? "Tenant" : "Landlord"}: {other ?? "User"} · {formatDate(t.startDate)} to {formatDate(t.endDate)}
                    </p>
                    <p className="text-sm">
                      {formatMoney(t.rentMinor, t.currency, { period: t.rentalPeriod })} ({RENTAL_PERIOD_LABELS[t.rentalPeriod].toLowerCase()})
                      {t.depositMinor ? ` · deposit ${formatMoney(t.depositMinor, t.currency)}` : ""}
                    </p>
                  </div>
                  <RecordPaymentButton
                    tenancyId={t.id}
                    currency={t.currency}
                    purposes={PURPOSES}
                    isPayee={t.myRole === "LANDLORD"}
                    defaultAmount={nextDue ? minorToMajorString(nextDue.amountMinor - nextDue.paidMinor, t.currency) : undefined}
                  />
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted uppercase">
                        <th className="py-2 font-semibold">Due</th>
                        <th className="py-2 font-semibold">Item</th>
                        <th className="py-2 text-right font-semibold">Amount</th>
                        <th className="py-2 text-right font-semibold">Recorded paid</th>
                        <th className="py-2 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.schedule.map((s) => (
                        <tr key={s.id} className="border-b border-line/60 last:border-0">
                          <td className="py-2">{formatDate(s.dueDate)}</td>
                          <td className="py-2">{s.label}</td>
                          <td className="py-2 text-right">{formatMoney(s.amountMinor, s.currency)}</td>
                          <td className="py-2 text-right">{formatMoney(s.paidMinor, s.currency)}</td>
                          <td className="py-2 text-right">
                            <StatusBadge status={s.settledAt ? "PAID" : s.dueDate < today ? "OVERDUE" : s.paidMinor > 0n ? "PART_PAID" : "UPCOMING"} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
