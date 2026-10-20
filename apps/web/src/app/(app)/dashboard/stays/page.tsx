import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble } from "lucide-react";
import { STAY_KIND_LABELS, formatDate, formatDateTime, formatMoney } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { myStayBookings } from "@/server/services/stays";
import { PageHeader } from "@/components/dashboard/shell";
import { StayStatusBadge } from "@/components/stays/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Stays and bookings" };

export default async function MyStaysPage() {
  const actor = await requirePageActor("/dashboard/stays");
  const bookings = await myStayBookings(actor);
  return (
    <>
      <PageHeader
        title="Stays and bookings"
        description="Hotels, guest houses, motels and short-stay homes you have booked through Sukkot Salone."
        actions={<Link href="/stays" className={buttonClasses("secondary")}>Book a stay</Link>}
      />
      {bookings.length === 0 ? (
        <EmptyState icon={<BedDouble className="h-6 w-6" />} title="No bookings yet" body="Find a hotel, guest house, motel or short-stay home and ask for your dates. We check with the property for you." action={<Link href="/stays" className={buttonClasses("primary")}>Find a stay</Link>} />
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/stays/${b.reference}`} className="card flex flex-col gap-2 p-4 hover:border-navy-600 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{b.property.title}</p>
                  <p className="text-sm text-muted">
                    {b.property.stayKind ? `${STAY_KIND_LABELS[b.property.stayKind]} · ` : ""}
                    {b.roomType.name} · {formatDate(b.checkIn)} to {formatDate(b.checkOut)} · {b.nights} night{b.nights === 1 ? "" : "s"} · {formatMoney(b.totalMinor, b.currency)}
                  </p>
                  <p className="font-mono text-xs text-muted">{b.reference}</p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <StayStatusBadge status={b.status} />
                  {b.status === "CONFIRMED" && b.paymentDueAt && <span className="text-xs font-semibold text-clay-700">Pay by {formatDateTime(b.paymentDueAt)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
