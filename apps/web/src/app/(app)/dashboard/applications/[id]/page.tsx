import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDateTime, formatMoney, minorToMajorString, NOTICES, RENTAL_PERIOD_LABELS, type Currency, type RentalPeriod } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";
import { getApplication } from "@/server/services/applications";
import { db } from "@/server/db";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge, humanize } from "@/components/dashboard/status-badge";
import { WorkflowActions } from "@/components/dashboard/workflow-actions";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Rental application" };

interface Terms {
  rentMinor: string;
  currency: Currency;
  rentalPeriod: RentalPeriod;
  advanceRentPeriods: number;
  depositMinor: string | null;
  startDate: string;
  leaseMonths: number;
  conditions: string | null;
}

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor(`/dashboard/applications/${id}`);
  const a = await getApplication(actor, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const d = a.details;
  const terms = d.proposedTerms as Terms | null;
  const property = await db.property.findUnique({ where: { id: a.property.id }, select: { priceMinor: true, currency: true, rentalPeriod: true } });
  const rows: [string, string | null | undefined][] = [
    ["Move-in date", formatDate(d.moveInDate)],
    ["Lease length", `${d.leaseMonths} months`],
    ["Occupants", String(d.occupants)],
    ["Employment", humanize(d.employmentStatus)],
    ["Employer or business", d.employerOrBusiness],
    ["Monthly income", d.monthlyIncomeBand ? d.monthlyIncomeBand.replace("UNDER_5K", "Under Le 5,000").replace("5K_15K", "Le 5,000 to 15,000").replace("15K_50K", "Le 15,000 to 50,000").replace("OVER_50K", "Over Le 50,000").replace("PREFER_NOT", "Prefer not to say") : null],
    ["Current address", d.currentAddress],
    ["Reference", d.referenceName ? `${d.referenceName}${d.referencePhone ? ` (${d.referencePhone})` : ""}` : null],
  ];

  return (
    <>
      <Link href="/dashboard/applications" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Applications
      </Link>
      <PageHeader
        title={a.property.title}
        description={a.myRole === "LANDLORD" ? `Application from ${a.applicant.name}` : "Your rental application"}
        actions={d.conversation ? <ButtonLink href={`/dashboard/messages/${d.conversation.id}`} variant="outline" size="sm">Messages</ButtonLink> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <StatusBadge status={a.status} kind="application" />
              <span className="text-xs text-muted">Created {formatDateTime(d.createdAt)}</span>
            </div>
            <WorkflowActions
              kind="application"
              endpoint={`/applications/${a.id}`}
              actions={a.actions}
              currency={terms?.currency ?? property?.currency ?? "SLE"}
              defaults={{
                rent: property ? minorToMajorString(property.priceMinor, property.currency) : undefined,
                rentalPeriod: property?.rentalPeriod ?? "YEAR",
                leaseMonths: d.leaseMonths,
                startDate: d.moveInDate.toISOString().slice(0, 10),
              }}
            />
            {d.tenancy && (
              <Notice tone="success">
                Tenancy recorded. <Link className="link" href="/dashboard/tenancies">View rent schedule</Link>
              </Notice>
            )}
          </section>

          {terms && (
            <section className="card space-y-2 p-5 text-sm">
              <h2 className="font-bold text-navy-900">Proposed terms from the landlord</h2>
              <p>Rent: <strong>{formatMoney(BigInt(terms.rentMinor), terms.currency, { period: terms.rentalPeriod })}</strong> ({RENTAL_PERIOD_LABELS[terms.rentalPeriod].toLowerCase()})</p>
              <p>Paid in advance: {terms.advanceRentPeriods} period(s)</p>
              {terms.depositMinor && <p>Security deposit: {formatMoney(BigInt(terms.depositMinor), terms.currency)}</p>}
              <p>Start: {formatDate(terms.startDate)} for {terms.leaseMonths} months</p>
              {terms.conditions && <p className="whitespace-pre-wrap">Conditions: {terms.conditions}</p>}
              <Notice className="mt-3">{NOTICES.rentalTermsReview}</Notice>
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-navy-900">Application details</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {rows.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {d.message && <p className="mt-4 rounded-lg bg-canvas p-3 text-sm whitespace-pre-wrap">{d.message}</p>}
          </section>
        </div>

        <aside className="card h-fit p-5">
          <h2 className="mb-3 font-bold text-navy-900">Timeline</h2>
          <ol className="space-y-4 border-l-2 border-line pl-4">
            {d.events.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-emerald-600" />
                <p className="font-medium">{humanize(e.toStatus)}</p>
                <p className="text-xs text-muted">{e.actor?.profile?.fullName ?? "System"} · {formatDateTime(e.createdAt)}</p>
                {e.note && <p className="mt-1 text-muted">{e.note}</p>}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
