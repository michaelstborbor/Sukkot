import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { STAY_KIND_LABELS, formatMoney, formatSlPhone, minorToMajorString, stayBooksWholePlace } from "@sukkot/shared";
import { can, requirePageActor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";
import { availableOnlineMethods } from "@/server/payments";
import { transferDetails } from "@/server/services/billing";
import { getStaySetup } from "@/server/services/stays";
import { PageHeader } from "@/components/dashboard/shell";
import { CheckoutButton } from "@/components/dashboard/checkout";
import { inIosApp } from "@/server/ios-app";
import { JsonForm, type JsonField } from "@/components/dashboard/json-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { StayDetailsForm } from "@/components/stays/stay-details-form";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Bookings set-up" };

function roomFields(whole: boolean, r?: { name: string; description: string | null; bedType: string | null; roomsCount: number; maxAdults: number; maxChildren: number; nightlyPriceMinor: bigint; monthlyPriceMinor: bigint | null; currency: "SLE" | "USD"; breakfastIncluded: boolean; features: string[]; isActive: boolean }): JsonField[] {
  const money = (m: bigint | null | undefined) => (m ? minorToMajorString(m, r?.currency ?? "SLE") : "");
  return [
    { name: "name", label: whole ? "Name" : "Room name", defaultValue: r?.name ?? (whole ? "Whole place" : ""), placeholder: whole ? "Whole place" : "Standard double" },
    { name: "bedType", label: "Beds", optional: true, defaultValue: r?.bedType ?? "", placeholder: whole ? "2 double beds" : "1 double bed" },
    ...(whole ? [] : [{ name: "roomsCount", label: "How many rooms of this kind", type: "number" as const, defaultValue: String(r?.roomsCount ?? 1) }]),
    { name: "maxAdults", label: "Most adults", type: "number", defaultValue: String(r?.maxAdults ?? 2) },
    { name: "maxChildren", label: "Most children", type: "number", defaultValue: String(r?.maxChildren ?? 0) },
    { name: "nightlyPrice", label: "Price per night", defaultValue: money(r?.nightlyPriceMinor), placeholder: "850" },
    { name: "monthlyPrice", label: "Price per month (30 nights)", optional: true, defaultValue: money(r?.monthlyPriceMinor), hint: "Leave empty if you do not offer a monthly rate" },
    { name: "currency", label: "Currency", type: "select", defaultValue: r?.currency ?? "SLE", options: [{ value: "SLE", label: "Leones (SLE)" }, { value: "USD", label: "US dollars" }] },
    { name: "description", label: "Description", type: "textarea", optional: true, defaultValue: r?.description ?? "", placeholder: whole ? "Two-bedroom apartment with a sea view and a fully equipped kitchen." : "Air-conditioned room with en-suite shower, TV and a desk." },
    { name: "features", label: "Features, one per line", type: "list", optional: true, defaultValue: (r?.features ?? []).join("\n"), placeholder: "En-suite bathroom\nAir conditioning\nSea view" },
    { name: "breakfastIncluded", label: "Breakfast included in the price", type: "checkbox", defaultValue: r?.breakfastIncluded ?? false },
    { name: "isActive", label: "Open for booking", type: "checkbox", defaultValue: r?.isActive ?? true },
  ];
}

export default async function StaySetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor(`/dashboard/properties/${id}/stay`);
  const iosApp = await inIosApp();
  const setup = await getStaySetup(actor, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { property: p, details, rooms, bookable, missing, feeSettled, fee } = setup;
  // The listing fee is a digital purchase, which the iPhone app does not offer (Apple in-app purchase rules).
  const shownMissing = iosApp ? missing.filter((m) => !m.endsWith("listing fee")) : missing;
  const isManager = p.listerId === actor.id || p.ownerId === actor.id;
  const staff = can(actor, "admin:bookings.manage");
  const whole = p.stayKind ? stayBooksWholePlace(p.stayKind) : false;
  const [methods, transfer] = isManager && !feeSettled && p.stayKind ? await Promise.all([availableOnlineMethods(), transferDetails()]) : [[], null];
  const feeLabel = fee ? formatMoney(BigInt(fee.priceMinor), fee.currency) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/dashboard/properties/${p.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {p.title}
      </Link>
      <PageHeader
        title="Bookings set-up"
        description="Guests choose dates and a room, we check availability with you, they pay Sukkot Salone, and we pay you after deducting our agreed commission."
        actions={bookable ? <ButtonLink href={`/stays/${p.slug}/book`} variant="outline" size="sm">See the booking page</ButtonLink> : undefined}
      />

      {p.purpose !== "SHORT_STAY" ? (
        <Notice tone="warning">Only listings offered as a short stay can take bookings. Change the listing&apos;s purpose to Short stay under Details first.</Notice>
      ) : bookable ? (
        <Notice tone="success" title="Taking bookings">Guests can book this {p.stayKind ? STAY_KIND_LABELS[p.stayKind].toLowerCase() : "place"} now. We will call or message you to confirm each booking before the guest pays.</Notice>
      ) : (
        <Notice tone="info" title="Not taking bookings yet">
          {shownMissing.length ? <>To start: {shownMissing.join("; ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}.</> : "The listing fee is not paid yet."}
        </Notice>
      )}

      {p.stayKind && !feeSettled && fee && !iosApp && (
        <section className="card space-y-3 border-gold-500 p-5">
          <h2 className="font-bold text-navy-900">Listing fee: {feeLabel}</h2>
          <p className="text-sm text-muted">One payment to list your {STAY_KIND_LABELS[p.stayKind].toLowerCase()} for bookings. It includes a visit from our team to take professional photos and video; we call you to agree a date once it is paid.</p>
          {isManager && <CheckoutButton label={`Pay ${feeLabel}`} title="Listing fee for bookings" amountLabel={feeLabel!} methods={methods} transfer={transfer} purpose="STAY_LISTING" propertyId={p.id} />}
          {!isManager && <p className="text-sm">The lister pays this from their dashboard, or open bookings below under an agreement with the management.</p>}
        </section>
      )}
      {p.stayListingPaidAt && <p className="text-sm text-muted">Listing fee paid.</p>}

      {staff && (
        <section className="card space-y-3 border-navy-600 p-5">
          <h2 className="font-bold text-navy-900">Staff: agreement with the management</h2>
          <p className="text-sm text-muted">
            Open bookings without the listing fee when we list the place under an agreement with its management, and record the commission we agreed. Payouts suggested in Bookings use it.
            {p.stayArrangedAt ? " Bookings are open by agreement." : ""}
            {p.stayCommissionBps !== null ? ` Commission: ${p.stayCommissionBps / 100}%.` : ""}
          </p>
          <JsonForm
            path={`/admin/stays/properties/${p.id}`}
            fields={[
              { name: "open", label: "Open for bookings by agreement (no listing fee)", type: "checkbox", defaultValue: !!p.stayArrangedAt, wide: true },
              { name: "commissionPercent", label: "Commission agreed (%)", type: "number", optional: true, defaultValue: p.stayCommissionBps !== null ? String(p.stayCommissionBps / 100) : "" },
            ]}
          />
        </section>
      )}

      <section className="card p-5">
        <h2 className="mb-1 font-bold text-navy-900">How your place works</h2>
        <p className="mb-4 text-sm text-muted">Guests see this on the booking page and their receipt.</p>
        <StayDetailsForm propertyId={p.id} initial={details ? { ...details, receptionPhone: details.receptionPhone ? formatSlPhone(details.receptionPhone) : undefined } : p.stayKind ? { kind: p.stayKind } : null} currencyLabel={p.currency} />
      </section>

      {p.stayKind && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-navy-900">{whole ? "Prices" : "Rooms and prices"}</h2>
          {rooms.map((r) => (
            <details key={r.id} className="card p-5">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="flex items-center gap-2 text-sm">
                  {formatMoney(r.nightlyPriceMinor, r.currency)} a night{r.monthlyPriceMinor ? ` · ${formatMoney(r.monthlyPriceMinor, r.currency)} a month` : ""}
                  {!whole && ` · ${r.roomsCount} room${r.roomsCount === 1 ? "" : "s"}`}
                  {!r.isActive && <Badge tone="danger">Not bookable</Badge>}
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                <JsonForm path={`/properties/${p.id}/stay/rooms/${r.id}`} method="PATCH" fields={roomFields(whole, r)} />
                <ActionButton path={`/properties/${p.id}/stay/rooms/${r.id}`} method="DELETE" label="Remove" variant="ghost" confirm="Remove this room? If guests have booked it, it is switched off instead, so their bookings are kept." success="Removed" />
              </div>
            </details>
          ))}
          {(!whole || rooms.filter((r) => r.isActive).length === 0) && (
            <div className="card p-5">
              <h3 className="mb-3 font-semibold">{whole ? "Set the prices" : rooms.length ? "Add another kind of room" : "Add your first kind of room"}</h3>
              <JsonForm path={`/properties/${p.id}/stay/rooms`} fields={roomFields(whole)} submitLabel={whole ? "Save prices" : "Add room"} success="Saved" reset />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
