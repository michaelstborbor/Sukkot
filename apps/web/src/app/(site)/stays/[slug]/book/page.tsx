import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, MapPin, ShieldCheck } from "lucide-react";
import { BREAKFAST_LABELS, CANCELLATION_POLICY_LABELS, STAY_FACILITIES, STAY_KIND_LABELS, formatMoney, formatSlPhone, stayDateString, stayToday } from "@sukkot/shared";
import { can, getCurrentActor } from "@/server/auth/actor";
import { db } from "@/server/db";
import { getSetting } from "@/server/services/settings";
import { getBookableStay } from "@/server/services/stays";
import { publicImageUrl } from "@/server/storage";
import { StayBookingForm } from "@/components/stays/booking-form";
import { Badge, Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Book your stay", robots: { index: false } };

export default async function BookStayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const stay = await getBookableStay(slug);
  if (!stay) notFound();
  const [actor, late] = await Promise.all([getCurrentActor(), getSetting("stay.lateBooking")]);
  // Unpublished listings stay private to their lister and our team.
  if (stay.listingStatus !== "PUBLISHED" && actor?.id !== stay.listerId && actor?.id !== stay.ownerId && !can(actor, "admin:bookings.manage")) notFound();
  const me = actor ? await db.user.findUnique({ where: { id: actor.id }, select: { email: true, phone: true, profile: { select: { fullName: true } } } }) : null;
  const { details, kind } = stay;
  const facilities = STAY_FACILITIES[kind].filter((f) => details.facilities.includes(f.key));
  const cover = stay.images[0];
  const policy = CANCELLATION_POLICY_LABELS[details.cancellationPolicy];

  return (
    <div className="container-page py-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/stays" className="hover:text-navy-900">Book a stay</Link> / <Link href={`/properties/${stay.slug}`} className="hover:text-navy-900">{stay.title}</Link> / <span className="text-ink">Book</span>
      </nav>
      {stay.isDemo && <Notice tone="info" className="mb-4">This is a demonstration listing. Bookings made here are for trying the site only; do not pay anyone for them.</Notice>}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">{STAY_KIND_LABELS[kind]}</Badge>
            {details.starRating && <Badge tone="neutral">{"★".repeat(details.starRating)} {details.starRating}-star</Badge>}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold text-navy-900">Book {stay.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-muted"><MapPin className="h-4 w-4" aria-hidden />{stay.locationLabel}</p>

          {!stay.bookable ? (
            <Notice tone="warning" className="mt-6" title="Not taking bookings right now">
              This place is not taking bookings through Sukkot Salone at the moment. <Link href={`/properties/${stay.slug}`} className="link">See the listing</Link> or <Link href="/stays" className="link">choose another place</Link>.
            </Notice>
          ) : (
            <div className="mt-6">
              <StayBookingForm
                propertyId={stay.id}
                kind={kind}
                details={details}
                today={stayDateString(stayToday())}
                noticeDays={late.noticeDays}
                surchargePercent={late.surchargePercent}
                signedIn={!!actor}
                signInHref={`/auth/sign-in?next=${encodeURIComponent(`/stays/${stay.slug}/book`)}`}
                guest={{ name: me?.profile?.fullName ?? "", phone: me?.phone ? formatSlPhone(me.phone) : "", email: me?.email ?? "" }}
                rooms={stay.stayRooms.map((r) => ({
                  id: r.id,
                  name: r.name,
                  description: r.description,
                  bedType: r.bedType,
                  roomsCount: r.roomsCount,
                  maxAdults: r.maxAdults,
                  maxChildren: r.maxChildren,
                  nightly: formatMoney(r.nightlyPriceMinor, r.currency),
                  monthly: r.monthlyPriceMinor ? formatMoney(r.monthlyPriceMinor, r.currency) : null,
                  breakfastIncluded: r.breakfastIncluded,
                  features: r.features,
                }))}
              />
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicImageUrl(cover.storageKey, 960)} alt={cover.alt ?? stay.title} className="aspect-[4/3] w-full rounded-2xl object-cover" />
          )}
          <div className="card space-y-3 p-5 text-sm">
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted" aria-hidden />Check-in from <strong>{details.checkInFrom}</strong>, check-out by <strong>{details.checkOutBy}</strong></p>
            {details.gateClosesAt && <p className="text-muted">The gate is locked at {details.gateClosesAt}. Tell us if you will arrive later.</p>}
            <p>{BREAKFAST_LABELS[details.breakfast]}</p>
            <p>Stays of {details.minNights === 1 ? "1 night" : `${details.minNights} nights`} to {details.maxNights} nights</p>
            {facilities.length > 0 && (
              <ul className="grid gap-1">
                {facilities.map((f) => <li key={f.key} className="flex items-start gap-1.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />{f.label}</li>)}
              </ul>
            )}
            <p className="text-muted">
              {details.childrenWelcome ? "Children welcome" : "No children"} · {details.petsAllowed ? "Pets allowed" : "No pets"} · {details.smokingAllowed ? "Smoking allowed" : "No smoking"}
              {details.idRequired ? " · Bring a passport or national ID" : ""}
            </p>
          </div>
          <div className="card space-y-2 p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />Cancellation: {policy.name}</p>
            <p className="text-muted">{policy.summary}</p>
            <p className="text-muted">Book {late.noticeDays} or more days ahead for the normal price. Later bookings cost {late.surchargePercent}% more.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
