import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CANCELLATION_POLICY_LABELS, STAY_KIND_LABELS, formatDate, formatDateTime, formatMoney, formatSlPhone, type StayExtras } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";
import { availableOnlineMethods } from "@/server/payments";
import { transferDetails } from "@/server/services/billing";
import { getStayBooking, guestRefundIfCancelled, paymentAwaitingCheck, readStayDetails } from "@/server/services/stays";
import { locationParts } from "@/server/services/properties";
import { PageHeader } from "@/components/dashboard/shell";
import { CheckoutButton } from "@/components/dashboard/checkout";
import { ActionButton } from "@/components/dashboard/action-button";
import { StayStatusBadge } from "@/components/stays/status-badge";
import { extrasSummary } from "@/components/stays/extras";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Booking" };

const STEPS = ["Asked", "Property confirmed", "Paid", "Stay"] as const;

export default async function StayBookingPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const actor = await requirePageActor(`/dashboard/stays/${reference}`);
  const b = await getStayBooking(actor, reference).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const own = b.guestId === actor.id;
  const [methods, transfer] = b.status === "CONFIRMED" && own ? await Promise.all([availableOnlineMethods(), transferDetails()]) : [[], null];
  const details = readStayDetails(b.property.stayDetails);
  const awaiting = paymentAwaitingCheck(b);
  const refundNow = guestRefundIfCancelled(b);
  const step = b.status === "REQUESTED" ? 0 : b.status === "CONFIRMED" ? 1 : b.status === "PAID" ? 2 : b.status === "COMPLETED" ? 3 : -1;
  const lines = ((b.priceBreakdown as { lines?: { label: string; amountMinor: string }[] }).lines ?? []);
  const extras = extrasSummary(b.extras as StayExtras);
  const total = formatMoney(b.totalMinor, b.currency);
  const canCancel = own && (b.status === "REQUESTED" || b.status === "CONFIRMED" || b.status === "PAID") && !awaiting;

  return (
    <div className="max-w-3xl">
      <PageHeader title={b.property.title} description={`${b.property.stayKind ? STAY_KIND_LABELS[b.property.stayKind] : "Stay"} · ${locationParts(b.property.location).label} · booking ${b.reference}`} actions={<StayStatusBadge status={b.status} />} />

      {step >= 0 && (
        <ol className="mb-6 grid grid-cols-4 gap-1 text-center text-xs font-semibold" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("rounded-lg px-1 py-2", i <= step ? "bg-emerald-600 text-white" : "bg-navy-50 text-muted")} aria-current={i === step ? "step" : undefined}>{s}</li>
          ))}
        </ol>
      )}

      {b.status === "REQUESTED" && (
        <Notice tone="info" title="We are checking with the property" className="mb-4">
          Our team is asking {b.property.title} to hold your room. We will notify you and email {b.guestEmail} as soon as they answer. Nothing has been charged.
          {b.isLate ? " This is a late booking, so the property may not be able to confirm at short notice." : ""}
        </Notice>
      )}
      {b.status === "CONFIRMED" && (
        <div className="card mb-4 space-y-3 border-gold-500 p-5">
          <h2 className="font-bold text-navy-900">The property has confirmed your room. Pay {total} to secure it.</h2>
          <p className="text-sm">Pay Sukkot Salone by <strong>{b.paymentDueAt ? formatDateTime(b.paymentDueAt) : "the deadline"}</strong>, or the room is released. {b.staffNote}</p>
          {awaiting ? (
            <Notice tone="info" title="Payment sent">We have your payment {awaiting.reference} and our finance team is checking it. The room stays held while they do.</Notice>
          ) : own ? (
            <CheckoutButton
              label={`Pay ${total}`}
              title={`Booking ${b.reference}`}
              amountLabel={total}
              methods={methods}
              transfer={transfer}
              purpose="STAY_BOOKING"
              stayBookingId={b.id}
              transferHint="Paying from abroad? Use an international bank transfer to the account above, or a money transfer app that pays into Orange Money or Afrimoney, then enter its transaction ID."
            />
          ) : null}
        </div>
      )}
      {(b.status === "PAID" || b.status === "COMPLETED") && (
        <Notice tone="success" title="You're booked" className="mb-4">
          Your payment is confirmed. {b.roomNumber ? `Your room is ${b.roomNumber}. ` : "The property gives you your room number at check-in, or we add it to your receipt when they tell us. "}
          <Link href={`/dashboard/stays/${b.reference}/receipt`} className="link font-semibold">Open your receipt</Link>
        </Notice>
      )}
      {b.status === "UNAVAILABLE" && <Notice tone="warning" title="The property could not take this booking" className="mb-4">{b.cancelReason} You have not been charged. <Link href="/stays" className="link">Find another place</Link></Notice>}
      {b.status === "EXPIRED" && <Notice tone="warning" title="Not paid in time" className="mb-4">The room was released because payment did not reach us by the deadline. <Link href={`/stays/${b.property.slug}/book`} className="link">Ask for the dates again</Link></Notice>}
      {b.status === "NO_SHOW" && <Notice tone="warning" className="mb-4">The property recorded that you did not arrive. Contact us if that is wrong.</Notice>}
      {b.status === "CANCELLED" && (
        <Notice tone="warning" title="Cancelled" className="mb-4">
          {b.cancelReason ? `${b.cancelReason} ` : ""}
          {b.refundDueMinor !== null && b.refundDueMinor > 0n
            ? b.refundedMinor >= b.refundDueMinor
              ? `We have sent back ${formatMoney(b.refundedMinor, b.currency)}.`
              : `We will send back ${formatMoney(b.refundDueMinor - b.refundedMinor, b.currency)} to the number or account you paid from.`
            : b.paidAt
              ? "No refund was due under the cancellation policy."
              : "Nothing was charged."}
        </Notice>
      )}

      <section className="card divide-y divide-line text-sm">
        <dl className="grid gap-3 p-5 sm:grid-cols-2">
          <div><dt className="text-muted">Check-in</dt><dd className="font-semibold">{formatDate(b.checkIn)}{details ? `, from ${details.checkInFrom}` : ""}</dd></div>
          <div><dt className="text-muted">Check-out</dt><dd className="font-semibold">{formatDate(b.checkOut)}{details ? `, by ${details.checkOutBy}` : ""}</dd></div>
          <div><dt className="text-muted">Room</dt><dd className="font-semibold">{b.rooms > 1 ? `${b.rooms} × ` : ""}{b.roomType.name}{b.roomNumber ? ` (room ${b.roomNumber})` : ""}</dd></div>
          <div><dt className="text-muted">Guests</dt><dd className="font-semibold">{b.adults} adult{b.adults === 1 ? "" : "s"}{b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}</dd></div>
          <div><dt className="text-muted">Lead guest</dt><dd>{b.guestName} · {formatSlPhone(b.guestPhone)} · {b.guestEmail}</dd></div>
          {b.arrivalTime && <div><dt className="text-muted">Arriving about</dt><dd>{b.arrivalTime}</dd></div>}
          {extras.length > 0 && <div className="sm:col-span-2"><dt className="text-muted">Requests</dt><dd>{extras.join(" · ")}</dd></div>}
          {b.specialRequests && <div className="sm:col-span-2"><dt className="text-muted">Note for the property</dt><dd className="whitespace-pre-line">{b.specialRequests}</dd></div>}
        </dl>
        <dl className="space-y-1.5 p-5">
          {lines.map((l) => <div key={l.label} className="flex justify-between gap-4"><dt className="text-muted">{l.label}</dt><dd>{formatMoney(l.amountMinor, b.currency)}</dd></div>)}
          <div className="flex justify-between gap-4 border-t border-line pt-2 text-base"><dt className="font-semibold">Total</dt><dd className="font-bold text-navy-900">{total}</dd></div>
        </dl>
        <p className="p-5 text-muted"><strong className="text-ink">Cancellation: {CANCELLATION_POLICY_LABELS[b.cancellationPolicy].name}.</strong> {CANCELLATION_POLICY_LABELS[b.cancellationPolicy].summary}{b.lateFeeMinor > 0n ? " The late booking charge is not refunded." : ""}</p>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {(b.status === "PAID" || b.status === "COMPLETED") && <Link href={`/dashboard/stays/${b.reference}/receipt`} className={buttonClasses("secondary")}>Receipt</Link>}
        {canCancel && (
          <ActionButton
            path={`/stays/${b.reference}/cancel`}
            label="Cancel this booking"
            variant="ghost"
            confirm={b.status === "PAID" ? `Cancel this stay? Under the cancellation policy you get back ${formatMoney(refundNow, b.currency)} of the ${total} you paid.` : "Cancel this booking request? Nothing has been charged."}
            reason={{ label: "Why are you cancelling? (optional)", placeholder: "Plans changed" }}
            success="Booking cancelled"
          />
        )}
      </div>
    </div>
  );
}
