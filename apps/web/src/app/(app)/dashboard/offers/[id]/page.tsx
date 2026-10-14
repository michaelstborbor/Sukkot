import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDateTime, NOTICES, OFFER_STATUS_LABELS } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";
import { getOffer } from "@/server/services/offers";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge, humanize } from "@/components/dashboard/status-badge";
import { WorkflowActions } from "@/components/dashboard/workflow-actions";
import { DueDiligenceList } from "@/components/dashboard/due-diligence";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Offer" };

const ARRANGEMENT: Record<string, string> = { FULL_PAYMENT: "Full payment", INSTALMENTS: "Instalments", MORTGAGE_OR_LOAN: "Mortgage or loan", OTHER: "Other" };

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor(`/dashboard/offers/${id}`);
  const o = await getOffer(actor, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const showDD = o.dueDiligence.length > 0 && ["ACCEPTED_IN_PRINCIPLE", "PENDING_DUE_DILIGENCE", "TRANSACTION_IN_PROGRESS", "COMPLETED"].includes(o.status);
  return (
    <>
      <Link href="/dashboard/offers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Offers
      </Link>
      <PageHeader
        title={o.property.title}
        description={o.myRole === "SELLER" ? `Offer from ${o.buyer.name}` : "Your offer"}
        actions={o.conversationId ? <ButtonLink href={`/dashboard/messages/${o.conversationId}`} variant="outline" size="sm">Messages</ButtonLink> : undefined}
      />
      <Notice tone="warning" className="mb-6">{NOTICES.offerNotLegal}</Notice>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={o.status} kind="offer" />
              {o.expiresAt && <span className="text-xs text-muted">Expires {formatDate(o.expiresAt)}</span>}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Current amount</dt><dd className="text-xl font-bold text-navy-900">{o.currentAmount.formatted}</dd></div>
              <div><dt className="text-muted">Asking price</dt><dd className="font-semibold">{o.askingPrice.formatted}</dd></div>
              <div><dt className="text-muted">Payment arrangement</dt><dd className="font-semibold">{ARRANGEMENT[o.paymentArrangement] ?? o.paymentArrangement}</dd></div>
            </dl>
            <WorkflowActions kind="offer" endpoint={`/offers/${o.id}`} actions={o.actions} currency={o.currentAmount.currency} />
            {o.actions.length === 0 && !["COMPLETED", "REJECTED", "WITHDRAWN", "EXPIRED"].includes(o.status) && (
              <p className="text-sm text-muted">Waiting for the other side to respond.</p>
            )}
          </section>
          {showDD && (
            <section className="card p-5">
              <h2 className="font-bold text-navy-900">Due diligence checklist</h2>
              <p className="mb-4 text-sm text-muted">A shared checklist for both sides. Ticking an item here records progress only; it does not verify anything. Use a qualified lawyer.</p>
              <DueDiligenceList items={o.dueDiligence.map((d) => ({ id: d.id, title: d.title, guidance: d.guidance, status: d.status, notes: d.notes }))} />
            </section>
          )}
        </div>
        <aside className="card h-fit p-5">
          <h2 className="mb-3 font-bold text-navy-900">Negotiation history</h2>
          <ol className="space-y-4 border-l-2 border-line pl-4">
            {o.events.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-gold-500" />
                <p className="font-medium">
                  {humanize(e.type)}
                  {e.amount ? `: ${e.amount.formatted}` : ""}
                </p>
                <p className="text-xs text-muted">{e.actorName} ({e.actorSide.toLowerCase()}) · {formatDateTime(e.createdAt)}</p>
                {e.conditions.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-muted">{e.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
                )}
                {e.message && <p className="mt-1 text-muted">&ldquo;{e.message}&rdquo;</p>}
                <p className="mt-0.5 text-xs text-muted">Status: {OFFER_STATUS_LABELS[e.statusAfter]}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
