import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PAYMENT_METHOD_LABELS, STAY_KIND_LABELS, formatDate, formatDateTime, formatMoney, formatSlPhone, type StayExtras } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";
import { getStayReceipt } from "@/server/services/stays";
import { brand } from "@/config/brand";
import { PrintButton } from "@/components/stays/print-button";
import { Notice } from "@/components/ui/misc";
import { extrasSummary } from "@/components/stays/extras";

export const metadata: Metadata = { title: "Booking receipt", robots: { index: false } };

/** The guest's receipt: shown at check-in, with the address, room and dates. */
export default async function StayReceiptPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const actor = await requirePageActor(`/dashboard/stays/${reference}/receipt`);
  const receipt = await getStayReceipt(actor, reference).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "CONFLICT")) return null;
    throw e;
  });
  if (!receipt) notFound();
  const { booking: b, payment, details, address } = receipt;
  const lines = (b.priceBreakdown as { lines?: { label: string; amountMinor: string }[] }).lines ?? [];
  const extras = extrasSummary(b.extras as StayExtras);
  const cancelled = b.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/dashboard/stays/${b.reference}`} className="link text-sm">Back to the booking</Link>
        <PrintButton />
      </div>
      <article className="card space-y-6 p-6 sm:p-8 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="font-display text-2xl font-semibold text-navy-900">{brand.name}</p>
            <p className="text-sm text-muted">Booking receipt</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-mono font-semibold">{b.reference}</p>
            <p className="text-muted">Paid {formatDate(b.paidAt ?? payment.paidAt ?? payment.createdAt)}</p>
          </div>
        </header>
        {cancelled && <Notice tone="warning" title="This booking was cancelled">This receipt is a record of the payment only. It is not valid for check-in.</Notice>}

        <section>
          <h1 className="text-xl font-bold text-navy-900">{b.property.title}</h1>
          <p className="text-sm text-muted">{b.property.stayKind ? STAY_KIND_LABELS[b.property.stayKind] : "Stay"}</p>
          <p className="mt-2"><span className="text-muted">Address:</span> {address}</p>
          {details?.receptionPhone && <p><span className="text-muted">Property phone:</span> {formatSlPhone(details.receptionPhone)}</p>}
        </section>

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Check-in</dt><dd className="text-base font-semibold">{formatDate(b.checkIn)}{details ? `, from ${details.checkInFrom}` : ""}</dd></div>
          <div><dt className="text-muted">Check-out</dt><dd className="text-base font-semibold">{formatDate(b.checkOut)}{details ? `, by ${details.checkOutBy}` : ""}</dd></div>
          <div><dt className="text-muted">Room</dt><dd className="font-semibold">{b.rooms > 1 ? `${b.rooms} × ` : ""}{b.roomType.name}{b.roomType.bedType ? `, ${b.roomType.bedType}` : ""}</dd></div>
          <div><dt className="text-muted">Room number</dt><dd className="font-semibold">{b.roomNumber ?? "Given at check-in"}</dd></div>
          <div><dt className="text-muted">Nights</dt><dd>{b.nights}</dd></div>
          <div><dt className="text-muted">Guests</dt><dd>{b.adults} adult{b.adults === 1 ? "" : "s"}{b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted">Lead guest</dt><dd>{b.guestName} · {formatSlPhone(b.guestPhone)} · {b.guestEmail}</dd></div>
          {b.roomType.breakfastIncluded && <div className="sm:col-span-2"><dt className="text-muted">Meals</dt><dd>Breakfast included</dd></div>}
          {extras.length > 0 && <div className="sm:col-span-2"><dt className="text-muted">Requests passed to the property</dt><dd>{extras.join(" · ")}</dd></div>}
        </dl>

        <section className="rounded-xl bg-navy-50 p-4 text-sm">
          <dl className="space-y-1.5">
            {lines.map((l) => <div key={l.label} className="flex justify-between gap-4"><dt className="text-muted">{l.label}</dt><dd>{formatMoney(l.amountMinor, b.currency)}</dd></div>)}
            <div className="flex justify-between gap-4 border-t border-line pt-2 text-base"><dt className="font-semibold">Paid to {brand.name}</dt><dd className="font-bold">{formatMoney(b.totalMinor, b.currency)}</dd></div>
            {b.refundedMinor > 0n && <div className="flex justify-between gap-4"><dt className="text-muted">Refunded</dt><dd>{formatMoney(b.refundedMinor, b.currency)}</dd></div>}
          </dl>
          <p className="mt-3 text-xs text-muted">
            Payment {payment.reference} by {PAYMENT_METHOD_LABELS[payment.method]}
            {payment.externalReference ? `, transaction ${payment.externalReference}` : ""}, {payment.providerVerified ? "confirmed by the payment provider" : "checked and confirmed by our finance team"}
            {payment.paidAt ? ` on ${formatDateTime(payment.paidAt)}` : ""}.
          </p>
        </section>

        <footer className="space-y-1 border-t border-line pt-4 text-xs text-muted">
          <p>The room is paid for in full. {details?.idRequired ? "Show this receipt and your passport or national ID at check-in. " : "Show this receipt at check-in. "}Extras you order at the property are paid there.</p>
          <p>Questions or changes: {brand.name}, {brand.supportPhone}, {brand.supportEmail}. Quote {b.reference}.</p>
        </footer>
      </article>
    </div>
  );
}
