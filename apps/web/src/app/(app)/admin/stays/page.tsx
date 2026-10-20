import type { Metadata } from "next";
import Link from "next/link";
import { CANCELLATION_POLICY_LABELS, PAYMENT_METHOD_LABELS, STAY_KIND_LABELS, formatDate, formatDateTime, formatMoney, formatSlPhone, type StayExtras } from "@sukkot/shared";
import { can, requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { bookingMoney, confirmedPayment, listStayBookings, paymentAwaitingCheck, readStayDetails } from "@/server/services/stays";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm } from "@/components/dashboard/json-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { StayStatusBadge } from "@/components/stays/status-badge";
import { extrasSummary } from "@/components/stays/extras";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings" };

export default async function AdminStaysPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requirePagePermission("admin:bookings.manage", "/admin/stays");
  const { status } = await searchParams;
  const finance = can(actor, "admin:payments.manage");
  const [bookings, places] = await Promise.all([
    listStayBookings(actor, status),
    db.property.findMany({
      where: { stayKind: { not: null } },
      select: { id: true, title: true, reference: true, stayKind: true, listingStatus: true, stayListingPaidAt: true, stayArrangedAt: true, stayCommissionBps: true, _count: { select: { stayRooms: { where: { isActive: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);
  const tabs = [
    { key: undefined, label: "To do" },
    { key: "PAID", label: "Paid, upcoming" },
    { key: "DONE", label: "Stayed" },
    { key: "CANCELLED", label: "Cancelled" },
    { key: "ALL", label: "All" },
  ];

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Hotel, guest house, motel and short-stay bookings. Call the property to check each request, confirm it so the guest can pay, record the room number, and record what we paid the property after the stay."
      />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Status">
        {tabs.map((t) => (
          <Link key={t.label} href={t.key ? `?status=${t.key}` : "?"} className={cn("rounded-full px-3 py-1 text-sm font-medium", t.key === status ? "bg-navy-900 text-white" : "bg-surface ring-1 ring-line")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings here" body="New booking requests appear under To do as soon as a guest sends them." />
      ) : (
        <ul className="space-y-4">
          {bookings.map((b) => {
            const details = readStayDetails(b.property.stayDetails);
            const paid = confirmedPayment(b);
            const awaiting = paymentAwaitingCheck(b);
            const commission = places.find((p) => p.id === b.propertyId)?.stayCommissionBps ?? null;
            const money = bookingMoney(b, commission);
            const extras = extrasSummary(b.extras as StayExtras);
            const lines = (b.priceBreakdown as { lines?: { label: string; amountMinor: string }[] }).lines ?? [];
            return (
              <li key={b.id} className="card space-y-3 p-5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/properties/${b.property.slug}`} className="font-semibold text-navy-900 hover:underline">{b.property.title}</Link>
                    <p className="text-muted">{b.property.stayKind ? STAY_KIND_LABELS[b.property.stayKind] : ""} · {b.property.reference} · booking <span className="font-mono">{b.reference}</span> · asked {formatDateTime(b.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.isLate && <Badge tone="danger">Late booking</Badge>}
                    <StayStatusBadge status={b.status} />
                  </div>
                </div>
                <p className="text-base">
                  <strong>{formatDate(b.checkIn)}</strong> to <strong>{formatDate(b.checkOut)}</strong> · {b.nights} night{b.nights === 1 ? "" : "s"} · {b.rooms > 1 ? `${b.rooms} × ` : ""}{b.roomType.name} · {b.adults} adult{b.adults === 1 ? "" : "s"}{b.children ? `, ${b.children} children` : ""}
                </p>
                <p>
                  Guest: {b.guestName} · <a className="link" href={`tel:${b.guestPhone}`}>{formatSlPhone(b.guestPhone)}</a> · {b.guestEmail}
                  {b.guestCountry ? ` · from ${b.guestCountry}` : ""}{b.arrivalTime ? ` · arriving about ${b.arrivalTime}` : ""}
                </p>
                {extras.length > 0 && <p><strong>Requests:</strong> {extras.join(" · ")}</p>}
                {b.specialRequests && <p className="whitespace-pre-line"><strong>Note:</strong> {b.specialRequests}</p>}
                <p className="text-muted">
                  {lines.map((l) => `${l.label}: ${formatMoney(l.amountMinor, b.currency)}`).join(" · ")} · <strong className="text-ink">Total {formatMoney(b.totalMinor, b.currency)}</strong> · {CANCELLATION_POLICY_LABELS[b.cancellationPolicy].name} cancellation
                  {details ? ` · check-in ${details.checkInFrom}, out ${details.checkOutBy}` : ""}
                </p>
                {b.propertyConfirmation && <p><strong>Confirmed with the property:</strong> {b.propertyConfirmation}{b.paymentDueAt && b.status === "CONFIRMED" ? ` · guest must pay by ${formatDateTime(b.paymentDueAt)}` : ""}</p>}
                {b.roomNumber && <p><strong>Room:</strong> {b.roomNumber}</p>}
                {b.cancelReason && <p><strong>{b.status === "UNAVAILABLE" ? "Not available" : "Cancelled"}:</strong> {b.cancelReason}{b.cancelledBy ? ` (by ${b.cancelledBy === "GUEST" ? "the guest" : "staff"})` : ""}</p>}
                {awaiting && <Notice tone="info">The guest sent payment {awaiting.reference}{awaiting.externalReference ? `, transaction ${awaiting.externalReference}` : ""}. Finance checks it under <Link className="link" href="/admin/payments?status=AWAITING">Payments</Link>.</Notice>}
                {paid && (
                  <p className="rounded-lg bg-emerald-50 p-2.5">
                    Paid {money.received} · {PAYMENT_METHOD_LABELS[paid.method]} · <span className="font-mono">{paid.reference}</span> · {paid.providerVerified ? "provider confirmed" : "finance confirmed"}
                    {money.refunded ? ` · refunded ${money.refunded}` : ""}
                    {money.payout ? ` · paid to property ${money.payout} (ref ${b.payoutReference}) · our share ${money.commission}` : ""}
                  </p>
                )}
                {money.refundOutstanding && <Notice tone="warning" title={`Refund due: ${money.refundOutstanding}`}>Send it back to the number or account the guest paid from, then record it below.</Notice>}

                {b.status === "REQUESTED" && (
                  <details className="rounded-xl bg-navy-50 p-3" open>
                    <summary className="cursor-pointer font-semibold">The property confirmed: ask the guest to pay</summary>
                    <div className="mt-3">
                      <JsonForm
                        path={`/admin/stays/${b.id}`}
                        extra={{ action: "confirm" }}
                        submitLabel="Confirm and ask the guest to pay"
                        success="Confirmed; the guest has been asked to pay"
                        fields={[
                          { name: "propertyConfirmation", label: "Who confirmed, or their booking number", placeholder: "Fatmata at reception, their ref 2231", wide: true },
                          { name: "roomNumber", label: "Room number, if already given", optional: true },
                          { name: "payWithinHours", label: "Hours the guest has to pay", type: "number", optional: true, placeholder: b.isLate ? "12" : "48" },
                          { name: "note", label: "Note for the guest", optional: true, wide: true, placeholder: "Airport pickup is Le 600, paid at the hotel." },
                        ]}
                      />
                    </div>
                  </details>
                )}
                {(b.status === "CONFIRMED" || b.status === "PAID") && (
                  <details className="rounded-xl border border-line p-3">
                    <summary className="cursor-pointer font-semibold">{b.roomNumber ? "Change the room number" : "Record the room number"}</summary>
                    <div className="mt-3">
                      <JsonForm path={`/admin/stays/${b.id}`} extra={{ action: "room" }} success="Room saved" fields={[{ name: "roomNumber", label: "Room number", defaultValue: b.roomNumber ?? "" }, { name: "note", label: "Note for the guest", optional: true }]} />
                    </div>
                  </details>
                )}
                {b.status === "PAID" && (
                  <div className="flex flex-wrap gap-2">
                    <ActionButton path={`/admin/stays/${b.id}`} body={{ action: "outcome", outcome: "COMPLETED" }} label="Guest stayed" variant="secondary" success="Marked as stayed" />
                    <ActionButton path={`/admin/stays/${b.id}`} body={{ action: "outcome", outcome: "NO_SHOW" }} label="No-show" confirm="Record that the guest did not arrive? No refund is due for a no-show." success="Marked as no-show" />
                  </div>
                )}
                {finance && b.paidAt && !b.payoutAt && (b.status === "PAID" || b.status === "COMPLETED" || b.status === "NO_SHOW" || b.status === "CANCELLED") && (
                  <details className="rounded-xl border border-line p-3">
                    <summary className="cursor-pointer font-semibold">Record payment to the property</summary>
                    <div className="mt-3">
                      <JsonForm
                        path={`/admin/stays/${b.id}`}
                        extra={{ action: "payout" }}
                        success="Payout recorded"
                        fields={[
                          { name: "amount", label: `Amount paid to the property (${b.currency})`, defaultValue: money.suggestedPayoutMajor ?? "", hint: commission !== null ? `Suggested: what we kept less our ${commission / 100}% commission` : "No commission is recorded for this place" },
                          { name: "reference", label: "Transfer or receipt number" },
                        ]}
                      />
                    </div>
                  </details>
                )}
                {finance && money.refundOutstanding && (
                  <details className="rounded-xl border border-line p-3" open>
                    <summary className="cursor-pointer font-semibold">Record the refund sent</summary>
                    <div className="mt-3">
                      <JsonForm path={`/admin/stays/${b.id}`} extra={{ action: "refund" }} success="Refund recorded" fields={[{ name: "amount", label: `Amount sent back (${b.currency})`, defaultValue: money.refundOutstandingMajor ?? "" }, { name: "externalReference", label: "Refund transaction ID" }]} />
                    </div>
                  </details>
                )}
                {(b.status === "REQUESTED" || b.status === "CONFIRMED") && (
                  <ActionButton path={`/admin/stays/${b.id}`} body={{ action: "unavailable" }} reasonKey="reason" label="Not available" variant="ghost" reason={{ label: "Tell the guest why, and suggest other dates or places if you can", required: true }} success="The guest has been told" />
                )}
                {(b.status === "REQUESTED" || b.status === "CONFIRMED" || b.status === "PAID") && (
                  <div className="flex flex-wrap gap-2">
                    <ActionButton path={`/admin/stays/${b.id}`} body={{ action: "cancel", refund: "FULL" }} label={b.status === "PAID" ? "Cancel, full refund" : "Cancel booking"} variant="ghost" reason={{ label: "Why is it cancelled? The guest sees this.", required: true }} success="Booking cancelled" />
                    {b.status === "PAID" && (
                      <ActionButton path={`/admin/stays/${b.id}`} body={{ action: "cancel", refund: "POLICY" }} label="Cancel at the guest's request (policy refund)" variant="ghost" reason={{ label: "What did the guest ask? They see this.", required: true }} success="Booking cancelled" />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-navy-900">Places set up for bookings</h2>
        {places.length === 0 ? (
          <p className="text-sm text-muted">None yet. A lister sets a short-stay listing up for bookings from their listing page, or open the set-up page of any short-stay listing.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {places.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <Link href={`/dashboard/properties/${p.id}/stay`} className="font-semibold text-navy-900 hover:underline">{p.title}</Link>
                  <span className="text-muted"> · {p.reference} · {STAY_KIND_LABELS[p.stayKind!]} · {p._count.stayRooms} room type{p._count.stayRooms === 1 ? "" : "s"}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {p.stayArrangedAt ? <Badge tone="verified">By agreement</Badge> : p.stayListingPaidAt ? <Badge tone="verified">Fee paid</Badge> : <Badge tone="gold">Fee not paid</Badge>}
                  {p.stayCommissionBps !== null && <Badge>{p.stayCommissionBps / 100}% commission</Badge>}
                  {p.listingStatus !== "PUBLISHED" && <Badge tone="warning">Not published</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
