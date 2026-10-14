import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABELS, PAYMENT_PURPOSE_LABELS, PAYMENT_STATUSES, type PaymentStatus } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { availableOnlineMethods } from "@/server/payments";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requirePagePermission("admin:payments.view", "/admin/payments");
  const sp = await searchParams;
  const status = (PAYMENT_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as PaymentStatus) : undefined;
  const q = sp.q?.trim();
  const rows = await db.paymentTransaction.findMany({
    where: { ...(status ? { status } : {}), ...(q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { providerReference: { contains: q, mode: "insensitive" } }] } : {}) },
    include: {
      payer: { select: { email: true } },
      payee: { select: { email: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const methods = availableOnlineMethods();
  return (
    <>
      <PageHeader title="Payments" description="Every payment with its provider event history. Statuses change only through verified provider callbacks or the parties' own records." />
      <Notice className="mb-4">
        Online methods enabled: {methods.length ? methods.map((m) => PAYMENT_METHOD_LABELS[m]).join(", ") : "none"}. Configure credentials in the server environment; see docs/DEPLOYMENT.md.
      </Notice>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1">
          {[undefined, "PENDING", "SUCCEEDED", "RECORDED", "FAILED", "DISPUTED"].map((s) => (
            <Link key={s ?? "all"} href={s ? `?status=${s}` : "?"} className={cn("rounded-full px-3 py-1 text-sm font-medium", s === status ? "bg-navy-900 text-white" : "bg-white ring-1 ring-line")}>
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : "All"}
            </Link>
          ))}
        </nav>
        <form><input name="q" defaultValue={q} placeholder="Reference" aria-label="Search by reference" className="h-9 rounded-lg border border-line px-3 text-sm" /></form>
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
