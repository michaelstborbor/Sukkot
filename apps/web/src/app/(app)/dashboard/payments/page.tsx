import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, CreditCard, ShieldCheck } from "lucide-react";
import { formatDate, formatMoney, NOTICES, PAYMENT_METHOD_LABELS, PAYMENT_PURPOSE_LABELS } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { availableOnlineMethods, listMyPayments } from "@/server/payments";
import { transferDetails } from "@/server/services/billing";
import { myServiceFees } from "@/server/services/service-fees";
import { brand } from "@/config/brand";
import { CheckoutButton } from "@/components/dashboard/checkout";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ActionButton } from "@/components/dashboard/action-button";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ ref?: string; cancelled?: string }> }) {
  const actor = await requirePageActor("/dashboard/payments");
  const { ref, cancelled } = await searchParams;
  const [rows, fees, methods, transfer] = await Promise.all([listMyPayments(actor), myServiceFees(actor.id), availableOnlineMethods(), transferDetails()]);
  const due = fees.filter((f) => f.status === "DUE");
  const highlighted = ref ? rows.find((r) => r.reference === ref) : undefined;

  return (
    <>
      <PageHeader title="Payments" description="Online payments for plans and promotions, and records of rent or sale payments made directly between parties." />
      <Notice className="mb-4">{NOTICES.paymentHonesty}</Notice>
      {cancelled && <Notice tone="warning" className="mb-4">The payment was cancelled. You have not been charged.</Notice>}
      {highlighted && (highlighted.status === "PENDING" || highlighted.status === "CREATED") && (
        <Notice tone="info" className="mb-4" title="Waiting for the provider">
          Payment {highlighted.reference} is not confirmed yet. Approve it on your phone, then check the status below.
        </Notice>
      )}
      {due.length > 0 && (
        <section className="card mb-6 space-y-3 border-gold-500 p-5">
          <h2 className="font-bold text-navy-900">Service fees due to {brand.name}</h2>
          <p className="text-sm text-muted">
            Once rent, lease or purchase money has been paid to the landlord or seller, {brand.name}&apos;s service fee is due. Pay it here by mobile money or transfer, or pay our team directly (call or WhatsApp {brand.supportPhone}) and we will record it.
          </p>
          <ul className="divide-y divide-line">
            {due.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{formatMoney(f.amountMinor, f.currency)}</p>
                  <p className="text-sm text-muted">{f.description} · <span className="font-mono text-xs">{f.reference}</span></p>
                </div>
                <CheckoutButton
                  label={`Pay ${formatMoney(f.amountMinor, f.currency)}`}
                  title="Service fee"
                  amountLabel={formatMoney(f.amountMinor, f.currency)}
                  methods={methods}
                  transfer={transfer}
                  purpose="SUCCESS_FEE"
                  serviceFeeId={f.id}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No payments yet" />
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className={cn("card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between", p.reference === ref && "ring-2 ring-gold-500")}>
              <div className="flex min-w-0 gap-3">
                <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", p.direction === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-navy-50 text-navy-800")}>
                  {p.direction === "IN" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {p.amount.formatted} <span className="font-normal text-muted">· {PAYMENT_PURPOSE_LABELS[p.purpose]}</span>
                  </p>
                  <p className="truncate text-sm text-muted">
                    {PAYMENT_METHOD_LABELS[p.method]} · {p.property ? `${p.property.reference} · ` : ""}
                    {formatDate(p.paidAt ?? p.createdAt)} · <span className="font-mono text-xs">{p.reference}</span>
                    {p.externalReference ? ` · ref ${p.externalReference}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                {p.providerVerified ? (
                  <Badge tone="verified" title="Confirmed by the payment provider"><ShieldCheck className="h-3 w-3" /> Provider confirmed</Badge>
                ) : p.status === "RECORDED" ? (
                  <Badge title="Recorded by the parties; not verified by a payment provider">Recorded by parties</Badge>
                ) : null}
                {p.needsMyConfirmation && (
                  <>
                    <ActionButton path={`/payments/${p.id}/confirm`} body={{ confirm: true }} label="I received this" variant="secondary" success="Payment confirmed" />
                    <ActionButton path={`/payments/${p.id}/confirm`} body={{ confirm: false }} label="Not received" variant="ghost" confirm="Mark this payment as disputed? The payer will be notified." success="Marked as disputed" />
                  </>
                )}
                {p.direction === "OUT" && (p.status === "PENDING" || p.status === "CREATED") && !p.needsMyConfirmation && p.nextAction && (
                  <ActionButton path={`/payments/${p.id}/refresh`} label="Check status" success="Status checked" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
