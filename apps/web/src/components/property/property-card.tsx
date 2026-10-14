import Link from "next/link";
import { Bath, BedDouble, MapPin, Ruler } from "lucide-react";
import { AVAILABILITY_LABELS, LISTING_PURPOSE_LABELS, relativeTime, type PropertySummaryDTO } from "@sukkot/shared";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { FeaturedBadge, VerificationBadge } from "./badges";
import { FavoriteButton } from "./favorite-button";
import { CompareToggle } from "./compare";
import { PropertyImage } from "./property-image";

export function PropertyCard({ p, saved = false, layout = "grid", priority = false }: { p: PropertySummaryDTO; saved?: boolean; layout?: "grid" | "list"; priority?: boolean }) {
  const list = layout === "list";
  return (
    <article className={cn("group card relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]", list && "sm:flex")}>
      <div className={cn("relative aspect-[4/3] overflow-hidden bg-navy-50", list && "sm:aspect-auto sm:w-80 sm:shrink-0")}>
        <PropertyImage image={p.coverImage} sizes={list ? "(min-width: 640px) 320px, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} priority={priority} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge tone="dark">{LISTING_PURPOSE_LABELS[p.purpose]}</Badge>
          {p.featured && <FeaturedBadge />}
        </div>
        <div className="absolute top-3 right-3 flex gap-1.5">
          <CompareToggle propertyId={p.id} />
          <FavoriteButton propertyId={p.id} initial={saved} />
        </div>
        {p.availability !== "AVAILABLE" && (
          <div className="absolute right-3 bottom-3">
            <Badge tone="warning">{AVAILABILITY_LABELS[p.availability]}</Badge>
          </div>
        )}
        {p.coverImage?.illustrative && <span className="sr-only">Illustrative image, not a photograph of the property.</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">{p.typeName}</p>
          <p className="shrink-0 text-xs text-muted">{p.publishedAt ? relativeTime(p.publishedAt) : ""}</p>
        </div>
        <h3 className="mt-1 line-clamp-2 text-[17px] leading-snug font-semibold text-navy-900">
          <Link href={`/properties/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
            {p.title}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{p.locationLabel}{p.district && !p.locationLabel.includes(p.district) ? ` · ${p.district}` : ""}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/80">
          {p.bedrooms !== null && <span className="inline-flex items-center gap-1"><BedDouble className="h-4 w-4 text-muted" aria-hidden />{p.bedrooms} bed</span>}
          {p.bathrooms !== null && <span className="inline-flex items-center gap-1"><Bath className="h-4 w-4 text-muted" aria-hidden />{p.bathrooms} bath</span>}
          {(p.floorArea || p.plotSize) && <span className="inline-flex items-center gap-1"><Ruler className="h-4 w-4 text-muted" aria-hidden />{p.floorArea ?? p.plotSize}</span>}
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-4">
          <p className="text-lg font-bold text-navy-900">
            {p.price.formatted}
            {p.negotiable && <span className="ml-1.5 text-xs font-medium text-muted">negotiable</span>}
          </p>
          <div className="relative z-10 flex flex-wrap gap-1">
            {p.documentsReviewed && <VerificationBadge kind="PROPERTY_DOCUMENTS" compact />}
            {p.listerVerified && <VerificationBadge kind="IDENTITY" compact />}
          </div>
        </div>
        {p.isDemo && <p className="mt-2 text-[11px] text-muted">Demo listing · fictional</p>}
      </div>
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-5 w-4/5 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton mt-4 h-6 w-1/3 rounded" />
      </div>
    </div>
  );
}
