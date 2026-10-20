import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, CalendarDays, Car, Droplets, Eye, Hash, MapPin, Ruler, Sofa, Zap } from "lucide-react";
import {
  AVAILABILITY_LABELS,
  ELECTRICITY_LABELS,
  FURNISHING_LABELS,
  LISTING_PURPOSE_LABELS,
  NOTICES,
  VERIFICATION_BADGES,
  INSPECTED_BADGE,
  WATER_SUPPLY_LABELS,
  formatDate,
  listingEnquiry,
  formatMoney,
  relativeTime,
  type Electricity,
  type Furnishing,
  type WaterSupply,
} from "@sukkot/shared";
import { getCurrentActor } from "@/server/auth/actor";
import { getPropertyDetail, recordView, similarProperties } from "@/server/services/properties";
import { getSetting } from "@/server/services/settings";
import { brand } from "@/config/brand";
import { Gallery } from "@/components/property/gallery";
import { PropertyActions } from "@/components/property/action-forms";
import { LISTING_MESSAGE_ID } from "@/lib/whatsapp";
import { FavoriteButton } from "@/components/property/favorite-button";
import { ShareButton } from "@/components/property/share-button";
import { PropertyCard } from "@/components/property/property-card";
import { FeaturedBadge, InspectedBadge, VerificationBadge } from "@/components/property/badges";
import { Avatar, Badge, Notice } from "@/components/ui/misc";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPropertyDetail(slug, null);
  if (!p) return { title: "Listing not found", robots: { index: false } };
  const description = `${LISTING_PURPOSE_LABELS[p.purpose]}: ${p.typeName} in ${p.locationLabel}. ${p.price.formatted}. ${p.description.slice(0, 120)}`;
  const img = p.images[0];
  return {
    title: `${p.title} – ${p.price.formatted}`,
    description,
    alternates: { canonical: `/properties/${p.slug}` },
    openGraph: { title: p.title, description, type: "article", images: img && !img.url.endsWith(".svg") ? [{ url: img.url, width: 1600, height: 1200, alt: img.alt }] : undefined },
    robots: p.availability === "SOLD" || p.availability === "RENTED" ? { index: false, follow: true } : undefined,
  };
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  landUse: "Land use",
  accessRoad: "Access road",
  fenced: "Fenced",
  surveyPlanRef: "Survey plan reference",
  parcelRef: "Parcel reference",
  titleDocumentType: "Title document",
  permittedUse: "Permitted use",
  floors: "Floors",
  loadingAccess: "Loading access",
  wheelchairAccessible: "Wheelchair accessible",
  rooms: "Guest rooms",
  houseStyle: "House style",
  storeys: "Storeys",
  boysQuarters: "Boys' quarters",
  walledCompound: "Walled compound",
  floorLevel: "Floor",
  buildingFloors: "Floors in the building",
  selfContained: "Self-contained",
  lift: "Lift",
  maxGuests: "Sleeps",
  minNights: "Minimum stay (nights)",
  checkIn: "Check-in from",
  checkOut: "Check-out by",
};

const TERMS_LABELS: Record<string, string> = {
  advanceRentPeriods: "Advance rent (periods)",
  securityDeposit: "Security deposit",
  minLeaseMonths: "Minimum lease (months)",
  utilitiesPaidBy: "Utilities paid by",
  maintenanceBy: "Maintenance by",
  petsAllowed: "Pets",
  maxOccupants: "Maximum occupants",
  otherConditions: "Other conditions",
};

function humanise(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return String(v);
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const actor = await getCurrentActor();
  const p = await getPropertyDetail(slug, actor);
  if (!p) notFound();
  if (p.listingStatus === "PUBLISHED") await recordView(p.id).catch(() => undefined);
  const similar = await similarProperties({ id: p.id, category: p.category, purpose: p.purpose, district: p.district });
  const isOwn = actor?.id === p.lister.id;
  const [fee, successFee] = await Promise.all([getSetting("fees.viewing"), getSetting("fees.success")]);
  const available = p.availability === "AVAILABLE" || p.availability === "UNDER_OFFER";
  const whatsappMessage = listingEnquiry(p, process.env.APP_URL ? `${process.env.APP_URL}/properties/${p.slug}` : undefined);

  const specs = [
    p.bedrooms !== null && { icon: BedDouble, label: "Bedrooms", value: p.bedrooms },
    p.bathrooms !== null && { icon: Bath, label: "Bathrooms", value: p.bathrooms },
    p.floorArea && { icon: Ruler, label: "Floor area", value: p.floorArea },
    p.plotSize && { icon: Ruler, label: "Plot size", value: p.plotSize },
    p.furnishing && { icon: Sofa, label: "Furnishing", value: FURNISHING_LABELS[p.furnishing as Furnishing] },
    p.waterSupply && { icon: Droplets, label: "Water", value: WATER_SUPPLY_LABELS[p.waterSupply as WaterSupply] },
    p.electricity && { icon: Zap, label: "Electricity", value: ELECTRICITY_LABELS[p.electricity as Electricity] },
    p.parkingSpaces !== null && { icon: Car, label: "Parking", value: p.parkingSpaces ? `${p.parkingSpaces} spaces` : "None" },
    p.availableFrom && { icon: CalendarDays, label: "Available from", value: formatDate(p.availableFrom) },
  ].filter(Boolean) as { icon: typeof Bath; label: string; value: string | number }[];

  const attributes = Object.entries(p.attributes ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const terms = Object.entries(p.rentalTerms ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const amenityGroups = p.amenities.reduce<Record<string, string[]>>((acc, a) => {
    (acc[a.group] ??= []).push(a.name);
    return acc;
  }, {});

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.title,
    description: p.description.slice(0, 500),
    url: `${process.env.APP_URL ?? ""}/properties/${p.slug}`,
    datePosted: p.publishedAt,
    offers: { "@type": "Offer", price: Number(BigInt(p.price.amountMinor) / 100n), priceCurrency: p.price.currency, availability: p.availability === "AVAILABLE" ? "https://schema.org/InStock" : "https://schema.org/SoldOut" },
    address: { "@type": "PostalAddress", addressLocality: p.locationLabel, addressRegion: p.district ?? undefined, addressCountry: "SL" },
  };

  return (
    <div className="container-page py-6 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {!isOwn && <span id={LISTING_MESSAGE_ID} data-message={whatsappMessage} hidden />}
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-navy-900">Home</Link> / <Link href={`/properties?purpose=${p.purpose}`} className="hover:text-navy-900">{LISTING_PURPOSE_LABELS[p.purpose]}</Link> / <span className="text-ink">{p.reference}</span>
      </nav>

      {p.listingStatus !== "PUBLISHED" && (
        <Notice tone="warning" className="mb-4" title="Not public">This listing is {p.listingStatus.replace(/_/g, " ").toLowerCase()} and only visible to you and our team.</Notice>
      )}
      {p.isDemo && <Notice tone="info" className="mb-4">{NOTICES.demoContent} Do not contact or pay anyone about it.</Notice>}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <Gallery images={p.images} title={p.title} />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{LISTING_PURPOSE_LABELS[p.purpose]}</Badge>
            <Badge tone="neutral">{p.typeName}</Badge>
            {p.featured && <FeaturedBadge />}
            {p.inspectedAt && <InspectedBadge date={p.inspectedAt} />}
            {p.documentsReviewed && <VerificationBadge kind="PROPERTY_DOCUMENTS" />}
            <Badge tone={p.availability === "AVAILABLE" ? "verified" : "warning"}>{AVAILABILITY_LABELS[p.availability]}</Badge>
          </div>
          <h1 className="mt-3 font-display text-3xl leading-tight font-semibold text-navy-900 sm:text-4xl">{p.title}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-muted"><MapPin className="h-4 w-4" aria-hidden />{p.locationLabel}{p.district ? `, ${p.district}` : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1"><Hash className="h-4 w-4" aria-hidden />{p.reference}</span>
            <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" aria-hidden />{p.viewCount} views</span>
            <span>Updated {relativeTime(p.updatedAt)}</span>
          </div>

          {/* Price on mobile */}
          <div className="mt-5 rounded-2xl border border-line bg-surface p-4 lg:hidden">
            <p className="text-2xl font-bold text-navy-900">{p.price.formatted}</p>
            {p.negotiable && <p className="text-sm text-muted">Price negotiable</p>}
          </div>

          {specs.length > 0 && (
            <section className="mt-8" aria-labelledby="specs">
              <h2 id="specs" className="text-xl font-bold text-navy-900">Key facts</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-xl border border-line bg-surface p-3.5">
                    <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase"><s.icon className="h-4 w-4" aria-hidden />{s.label}</dt>
                    <dd className="mt-1 font-semibold text-navy-900">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {p.video && (
            <section className="mt-8" aria-labelledby="video">
              <h2 id="video" className="text-xl font-bold text-navy-900">Video</h2>
              <video
                src={p.video.url}
                poster={p.video.posterUrl}
                controls
                preload="none"
                playsInline
                className="mt-3 max-h-[70vh] w-full rounded-xl bg-navy-950 object-contain"
                width={p.video.width ?? undefined}
                height={p.video.height ?? undefined}
              >
                <a href={p.video.url}>Download the video</a>
              </video>
            </section>
          )}

          <section className="mt-8" aria-labelledby="desc">
            <h2 id="desc" className="text-xl font-bold text-navy-900">Description</h2>
            <div className="prose-body mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink/90">{p.description}</div>
          </section>

          {Object.keys(amenityGroups).length > 0 && (
            <section className="mt-8" aria-labelledby="amen">
              <h2 id="amen" className="text-xl font-bold text-navy-900">Amenities and utilities</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {Object.entries(amenityGroups).map(([group, names]) => (
                  <div key={group}>
                    <h3 className="text-sm font-semibold text-muted">{group}</h3>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {names.map((n) => <li key={n} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">{n}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              {p.securityFeatures.length > 0 && <p className="mt-3 text-sm text-muted">Security: {p.securityFeatures.join(", ")}</p>}
            </section>
          )}

          {attributes.length > 0 && (
            <section className="mt-8" aria-labelledby="attrs">
              <h2 id="attrs" className="text-xl font-bold text-navy-900">{p.category === "LAND" ? "Land details" : "Property details"}</h2>
              <dl className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
                {attributes.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-muted">{ATTRIBUTE_LABELS[k] ?? k}</dt>
                    <dd className="text-right font-medium">{k === "floorLevel" && v === 0 ? "Ground floor" : k === "checkIn" || k === "checkOut" ? String(v) : humanise(v)}</dd>
                  </div>
                ))}
              </dl>
              {p.category === "LAND" && <Notice tone="warning" className="mt-3">References are as provided by the lister. Confirm survey plans and title at the Ministry of Lands with a licensed surveyor and lawyer before paying.</Notice>}
            </section>
          )}

          {terms.length > 0 && (
            <section className="mt-8" aria-labelledby="terms">
              <h2 id="terms" className="text-xl font-bold text-navy-900">Rental terms</h2>
              <dl className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
                {terms.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-muted">{TERMS_LABELS[k] ?? k}</dt>
                    <dd className="text-right font-medium">{k === "securityDeposit" ? formatMoney(String(v), p.price.currency) : humanise(v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted">{NOTICES.rentalTermsReview}</p>
            </section>
          )}

          <section className="mt-8" aria-labelledby="loc">
            <h2 id="loc" className="text-xl font-bold text-navy-900">Location</h2>
            <div className="mt-3 rounded-xl border border-line bg-surface p-4 text-sm">
              <p className="font-medium">{`${p.locationLabel}${p.district && !p.locationLabel.includes(p.district) ? `, ${p.district}` : ""}`}</p>
              {p.coordinates && (
                <p className="mt-1 text-muted">
                  {p.coordinates.approximate ? "Approximate area shown to protect the owner's privacy. " : ""}
                  <a className="link" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${p.coordinates.lat}&mlon=${p.coordinates.lng}#map=${p.coordinates.approximate ? 14 : 17}/${p.coordinates.lat}/${p.coordinates.lng}`}>
                    Open map
                  </a>
                </p>
              )}
            </div>
          </section>

          {(p.videoUrl || p.virtualTourUrl) && (
            <section className="mt-8">
              <h2 className="text-xl font-bold text-navy-900">Video and tour</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {p.videoUrl && <li><a className="link" href={p.videoUrl} target="_blank" rel="noopener noreferrer">Watch the video</a></li>}
                {p.virtualTourUrl && <li><a className="link" href={p.virtualTourUrl} target="_blank" rel="noopener noreferrer">Open the virtual tour</a></li>}
              </ul>
            </section>
          )}

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold text-navy-900">Before you pay</h2>
            <Notice tone="warning">{NOTICES.inspectionSafety}</Notice>
            <Notice tone="info">{NOTICES.verificationLimits} <Link href="/verification" className="link">What our badges mean</Link></Notice>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <div className="hidden lg:block">
              <p className="text-3xl font-bold text-navy-900">{p.price.formatted}</p>
              {p.negotiable && <p className="text-sm text-muted">Price negotiable</p>}
              {p.price.currency === "USD" && <p className="mt-1 text-xs text-muted">Priced in US dollars by the lister. No conversion is applied.</p>}
            </div>
            <div className="mt-0 flex gap-2 lg:mt-4">
              <FavoriteButton propertyId={p.id} initial={p.saved} withLabel className="flex-1 justify-center ring-line" />
              <ShareButton title={p.title} path={`/properties/${p.slug}`} />
            </div>
            <hr className="my-5 border-line" />
            <PropertyActions
              propertyId={p.id}
              slug={p.slug}
              whatsappMessage={whatsappMessage}
              purpose={p.purpose}
              currency={p.price.currency}
              signedIn={!!actor}
              isOwnListing={isOwn}
              available={available}
              viewingFee={fee ? formatMoney(BigInt(fee.priceMinor), fee.currency) : null}
              serviceFee={successFee ? `${successFee.basisPoints / 100}%` : null}
            />
          </div>

          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{p.lister.kind === "AGENT" ? "Listed by agent" : "Listed by owner"}</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={p.lister.name} url={p.lister.avatarUrl} size={48} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy-900">{p.lister.name}</p>
                {p.lister.agencyName && <p className="truncate text-sm text-muted">{p.lister.agencyName}</p>}
                <p className="text-xs text-muted">Member since {formatDate(p.lister.memberSince)}</p>
              </div>
            </div>
            {p.lister.badges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">{p.lister.badges.map((b) => <VerificationBadge key={b} kind={b} />)}</div>
            ) : (
              <p className="mt-3 text-xs text-muted">This lister has not completed identity verification.</p>
            )}
            {p.lister.kind === "AGENT" && (
              <p className="mt-3 rounded-lg bg-navy-50 p-2.5 text-xs text-navy-800">
                Acting for: {p.listerCapacity === "AGENT_FOR_DEVELOPER" ? "a developer" : p.listerCapacity === "AGENT_FOR_OWNER" ? "the property owner" : "an authorised party"}. Ask to see the owner&apos;s written authority.
              </p>
            )}
            {p.lister.kind === "AGENT" && <Link href={`/agents/${p.lister.id}`} className="mt-3 inline-block text-sm link">View agent profile</Link>}
          </div>
          <p className="px-1 text-xs text-muted">
            {p.inspectedAt ? `${INSPECTED_BADGE.label} on ${formatDate(p.inspectedAt)}: ${INSPECTED_BADGE.means} ` : ""}
            {VERIFICATION_BADGES.PROPERTY_DOCUMENTS.label}: {p.documentsReviewed ? "yes" : "not yet"}. {brand.name} does not hold deposits or rent.
          </p>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16" aria-labelledby="similar">
          <h2 id="similar" className="mb-6 font-display text-2xl font-semibold text-navy-900">Similar properties</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => <PropertyCard key={s.id} p={s} />)}
          </div>
        </section>
      )}
    </div>
  );
}
