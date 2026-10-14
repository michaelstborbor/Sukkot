import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { formatDate } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { listApplications } from "@/server/services/applications";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Rental applications" };

export default async function ApplicationsPage() {
  const actor = await requirePageActor("/dashboard/applications");
  const rows = await listApplications(actor);
  return (
    <>
      <PageHeader title="Rental applications" description="Applications you have made, and applications for properties you let." />
      {rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No applications" body="Apply to rent from any rental listing." />
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/dashboard/applications/${a.id}`} className="flex flex-col gap-1 p-4 hover:bg-navy-50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">{a.property.title}</p>
                  <p className="text-sm text-muted">
                    {a.myRole === "LANDLORD" ? `Applicant: ${a.applicant.name}` : "Your application"} · move in {formatDate(a.moveInDate)} · {a.leaseMonths} months
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} kind="application" />
                  {a.actions.length > 0 && <span className="text-xs font-semibold text-gold-700">Action needed</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
