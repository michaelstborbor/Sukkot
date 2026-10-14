import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { formatDateTime, NOTICES } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { listInspections } from "@/server/services/inspections";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { WorkflowActions } from "@/components/dashboard/workflow-actions";
import { EmptyState, Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Inspections" };

export default async function InspectionsPage() {
  const actor = await requirePageActor("/dashboard/inspections");
  const rows = await listInspections(actor);
  const now = Date.now();
  const upcoming = rows.filter((r) => new Date(r.scheduledAt).getTime() >= now && ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"].includes(r.status));
  const past = rows.filter((r) => !upcoming.includes(r));
  return (
    <>
      <PageHeader title="Inspections" description="Property viewings you have requested or need to attend. All times are Freetown time (GMT)." />
      <Notice tone="warning" className="mb-6">{NOTICES.inspectionSafety}</Notice>
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No inspections" body="Request a viewing from any listing page." />
      ) : (
        <div className="space-y-8">
          <List title="Upcoming and pending" rows={upcoming} />
          <List title="Past and closed" rows={past} />
        </div>
      )}
    </>
  );
}

function List({ title, rows }: { title: string; rows: Awaited<ReturnType<typeof listInspections>> }) {
  if (!rows.length) return null;
  return (
    <section>
      <h2 className="mb-3 font-bold text-navy-900">{title}</h2>
      <ul className="space-y-3">
        {rows.map((i) => (
          <li key={i.id} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={i.status} kind="inspection" />
              <span className="text-xs text-muted">{i.myRole === "REQUESTER" ? "You requested this viewing" : `Requested by ${i.requester.name}`}</span>
            </div>
            <div>
              <Link href={`/properties/${i.property.slug}`} className="font-semibold text-navy-900 hover:underline">{i.property.title}</Link>
              <p className="text-sm">
                <span className="font-medium">{formatDateTime(i.scheduledAt)}</span> · {i.durationMinutes} minutes
              </p>
              {i.status === "RESCHEDULE_PROPOSED" && i.proposedAt && (
                <p className="mt-1 text-sm text-gold-700">New time proposed: {formatDateTime(i.proposedAt)}</p>
              )}
              {i.notes && <p className="mt-1 text-sm text-muted">{i.notes}</p>}
            </div>
            <WorkflowActions kind="inspection" endpoint={`/inspections/${i.id}`} actions={i.actions} />
          </li>
        ))}
      </ul>
    </section>
  );
}
