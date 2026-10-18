import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABELS, PAYMENT_PURPOSE_LABELS, PAYMENT_STATUSES, PLATFORM_COLLECTED_PURPOSES, type PaymentMethod, type PaymentStatus } from "@sukkot/shared";
import { can, requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { availableOnlineMethods, isAwaitingFinance, manualChannelOf } from "@/server/payments";
import { ActionButton } from "@/components/dashboard/action-button";
import { JsonForm } from "@/components/dashboard/json-form";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const actor = await requirePagePermission("admin:payments.view", "/admin/payments");
  const canManage = can(actor, "admin:payments.manage");
  const sp = await searchParams;
  const awaitingOnly = sp.status === "AWAITING";
  const status = awaitingOnly ? "PENDING" : (PAYMENT_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as PaymentStatus) : undefined;
  const q = sp.q?.trim();
  const transferFilter = awaitingOnly ? { payeeId: null, method: { in: ["MANUAL", "BANK_TRANSFER"] as PaymentMethod[] }, purpose: { in: [...PLATFORM_COLLECTED_PURPOSES] } } : {};
  const awaitingCount = await db.paymentTransaction.count({ where: { status: "PENDING", payeeId: null, method: { in: ["MANUAL", "BANK_TRANSFER"] }, purpose: { in: [...PLATFORM_COLLECTED_PURPOSES] } } });
  const rows = await db.paymentTransaction.findMany({
    where: {
      ...(status ? { status } : {}),
      ...transferFilter,
      ...(q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { providerReference: { contains: q, mode: "insensitive" } }, { externalReference: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: {
      payer: { select: { email: true } },
      payee: { select: { email: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const methods = await availableOnlineMethods();
  return (
    <>
      <PageHeader title="Payments" description="Every payment with its event history. Statuses change only through verified provider callbacks, the parties' own records, or a finance check of a transfer to Sukkot Salone." />
      <Notice className="mb-4">
        Online methods enabled: {methods.length ? methods.map((m) => PAYMENT_METHOD_LABELS[m]).join(", ") : "none"}. Configure credentials in the server environment; see docs/DEPLOYMENT.md.
      </Notice>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1">
          {[undefined, "AWAITING", "PENDING", "SUCCEEDED", "RECORDED", "REFUNDED", "FAILED", "DISPUTED"].map((s) => (
            <Link key={s ?? "all"} href={s ? `?status=${s}` : "?"} className={cn("rounded-full px-3 py-1 text-sm font-medium", s === (awaitingOnly ? "AWAITING" : status) ? "bg-navy-900 text-white" : "bg-white ring-1 ring-line")}>
              {s === "AWAITING" ? `Transfers to check (${awaitingCount})` : s ? s.charAt(0) + s.slice(1).toLowerCase() : "All"}
            </Link>
          ))}
        </nav>
        <form><input name="q" defaultValue={q} placeholder="Reference or transaction ID" aria-label="Search by reference or transaction ID" className="h-9 rounded-lg border border-line px-3 text-sm" /></form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No payments" />
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{formatMoney(p.amountMinor, p.currency)} · {PAYMENT_PURPOSE_LABELS[p.purpose]} · {PAYMENT_METHOD_LABELS[p.method]}</p>
                <span className="flex gap-2">
                  {p.providerVerified && <Badge tone="verified"><ShieldCheck className="h-3 w-3" /> Provider verified</Badge>}
                  <StatusBadge status={p.status} />
                </span>
              </div>
              <p className="text-muted">
                <span className="font-mono">{p.reference}</span>{p.providerReference ? ` · provider ${p.providerReference}` : ""} · {formatDateTime(p.createdAt)}
              </p>
              <p className="text-muted">Payer: {p.payer?.email ?? "unknown"}{p.payee ? ` · Payee: ${p.payee.email}` : " · Payee: Sukkot Salone"}</p>
              {isAwaitingFinance(p) && (
                <div className="mt-3 rounded-xl bg-warning-50 p-3">
                  <p>
                    Paid by <strong>{PAYMENT_METHOD_LABELS[manualChannelOf(p)!]}</strong> transfer for {p.notes}. Transaction ID <span className="font-mono font-semibold">{p.externalReference}</span>
                    {p.payerPhone ? <> from {p.payerPhone}</> : null}.
                  </p>
                  <p className="text-muted">Confirm only after you find this exact amount and transaction on Sukkot Salone&apos;s statement.</p>
                  {canManage && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ActionButton path={`/admin/payments/${p.id}/review`} body={{ approve: true }} label="Confirm received" variant="primary" confirm={`Confirm that ${formatMoney(p.amountMinor, p.currency)} with transaction ID ${p.externalReference} is on the statement. This activates the purchase.`} success="Payment confirmed" />
                      <ActionButton path={`/admin/payments/${p.id}/review`} body={{ approve: false }} label="Not found" variant="danger" reason={{ label: "Why is it rejected? The customer sees this.", required: true }} success="Payment rejected" />
                    </div>
                  )}
                </div>
              )}
              {canManage && p.payeeId === null && PLATFORM_COLLECTED_PURPOSES.includes(p.purpose) && (p.status === "SUCCEEDED" || p.status === "RECORDED") && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-emerald-700">Record a refund</summary>
                  <div className="mt-2 rounded-xl bg-navy-50 p-3">
                    <p className="mb-2 text-muted">Send {formatMoney(p.amountMinor, p.currency)} back to the wallet or account it came from first, then record it here. The customer is told.</p>
                    <JsonForm
                      path={`/admin/payments/${p.id}/refund`}
                      submitLabel="Record refund"
                      success="Refund recorded"
                      fields={[
                        { name: "externalReference", label: "Refund transaction ID", placeholder: "From the SMS or bank receipt" },
                        { name: "reason", label: "Reason (the customer sees this)", placeholder: "Inspection visit cancelled" },
                      ]}
                    />
                  </div>
                </details>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-emerald-700">{p.events.length} events</summary>
                <ol className="mt-2 space-y-1 text-xs">
                  {p.events.map((e) => (
                    <li key={e.id}>{formatDateTime(e.createdAt)} · {e.type} ({e.source}) {e.statusBefore ? `${e.statusBefore} → ` : ""}{e.statusAfter ?? ""}</li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
