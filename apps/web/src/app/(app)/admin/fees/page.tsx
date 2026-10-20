import type { Metadata } from "next";
import Link from "next/link";
import { Percent } from "lucide-react";
import { formatDate, formatMoney } from "@sukkot/shared";
import { can, requirePagePermission } from "@/server/auth/actor";
import { getSetting } from "@/server/services/settings";
import { listServiceFees } from "@/server/services/service-fees";
import { ActionButton } from "@/components/dashboard/action-button";
import { JsonForm } from "@/components/dashboard/json-form";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Service fees" };

const STATUS_TONE = { DUE: "warning", PAID: "verified", WAIVED: "neutral" } as const;

export default async function AdminServiceFeesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requirePagePermission("admin:payments.view", "/admin/fees");
  const canManage = can(actor, "admin:payments.manage");
  const { status } = await searchParams;
  const [fees, setting] = await Promise.all([listServiceFees(status), getSetting("fees.success")]);
  const rate = setting ? `${setting.basisPoints / 100}%` : null;
  return (
    <>
      <PageHeader
        title="Service fees"
        description={`The ${rate ?? "success"} fee tenants and buyers owe Sukkot Salone once rent, lease or purchase money is paid. Fees on payments recorded in the app are raised automatically; raise one here for a deal agreed through our team.`}
      />
      {!rate && <Notice tone="warning" className="mb-4">The service fee is switched off. Set the percentage in Site settings to start charging it.</Notice>}

      {canManage && rate && (
        <section className="card mb-6 p-5">
          <h2 className="mb-1 font-bold text-navy-900">Raise a fee for a deal</h2>
          <p className="mb-3 text-sm text-muted">Enter the full rent, lease or sale amount; the {rate} fee is worked out from it. The tenant or buyer is told by notification and email.</p>
          <JsonForm
            path="/admin/fees"
            submitLabel="Raise fee"
            success="Fee raised"
            reset
            fields={[
              { name: "payerEmail", label: "Tenant or buyer's email", type: "email" },
              { name: "dealAmount", label: "Rent, lease or sale amount", placeholder: "12000" },
              { name: "currency", label: "Currency", type: "select", defaultValue: "SLE", options: [{ value: "SLE", label: "SLE" }, { value: "USD", label: "USD" }] },
              { name: "propertyReference", label: "Listing reference", optional: true, placeholder: "SKT-12345" },
              { name: "description", label: "What the deal was", wide: true, placeholder: "One year's rent for the flat at Hill Station" },
            ]}
          />
        </section>
      )}

      <nav className="mb-4 flex flex-wrap gap-1">
        {[undefined, "DUE", "PAID", "WAIVED"].map((s) => (
          <Link key={s ?? "all"} href={s ? `?status=${s}` : "?"} className={cn("rounded-full px-3 py-1 text-sm font-medium", s === status ? "bg-navy-900 text-white" : "bg-surface ring-1 ring-line")}>
            {s ? s.charAt(0) + s.slice(1).toLowerCase() : "All"}
          </Link>
        ))}
      </nav>

      {fees.length === 0 ? (
        <EmptyState icon={<Percent className="h-6 w-6" />} title="No service fees" />
      ) : (
        <ul className="space-y-3">
          {fees.map((f) => (
            <li key={f.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[f.status]}>{f.status === "DUE" ? "Due" : f.status === "PAID" ? "Paid" : "Waived"}</Badge>
                <span className="font-semibold">{formatMoney(f.amountMinor, f.currency)}</span>
                <span className="font-mono text-xs text-muted">{f.reference}</span>
              </div>
              <p className="text-sm">{f.description}</p>
              <p className="text-sm text-muted">
                {f.payer.profile?.fullName ?? "User"} ({f.payer.email}){f.property ? ` · ${f.property.reference}` : ""} · raised {formatDate(f.createdAt)}
                {f.raisedById ? " by staff" : " automatically"}
                {f.paidAt ? ` · paid ${formatDate(f.paidAt)}` : ""}
                {f.waivedReason ? ` · waived: ${f.waivedReason}` : ""}
              </p>
              {canManage && f.status === "DUE" && (
                <div className="flex flex-col gap-3 border-t border-line pt-3 lg:flex-row lg:items-end lg:justify-between">
                  <JsonForm
                    path={`/admin/fees/${f.id}/received`}
                    submitLabel="Record payment received"
                    success="Payment recorded"
                    fields={[
                      { name: "method", label: "Paid by", type: "select", defaultValue: "CASH", options: [{ value: "CASH", label: "Cash to our team" }, { value: "ORANGE_MONEY", label: "Orange Money" }, { value: "AFRIMONEY", label: "Afrimoney" }, { value: "BANK_TRANSFER", label: "Bank transfer" }] },
                      { name: "externalReference", label: "Receipt or transaction number" },
                    ]}
                  />
                  <ActionButton path={`/admin/fees/${f.id}/waive`} label="Waive fee" variant="ghost" reason={{ label: "Why is this fee waived?", required: true }} success="Fee waived" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
