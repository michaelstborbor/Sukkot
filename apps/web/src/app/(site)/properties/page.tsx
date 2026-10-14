import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import {
  LISTING_PURPOSE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  parseSearchParams,
  serializeSearchParams,
  type SearchFilters,
} from "@sukkot/shared";
import { getCurrentActor } from "@/server/auth/actor";
import { searchProperties } from "@/server/services/properties";
import { searchOptions } from "@/server/services/search-options";
import { savedIds } from "@/server/services/favorites";
import { PropertyCard } from "@/components/property/property-card";
import { CompareBar } from "@/components/property/compare";
import { FilterPanel } from "@/components/search/filter-panel";
import { ResultsToolbar } from "@/components/search/results-toolbar";
import { SaveSearchButton } from "@/components/search/save-search";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function headline(f: SearchFilters, placeName: string | null) {
  const what = f.category ? PROPERTY_CATEGORY_LABELS[f.category] : "Property";
  const purpose = f.purpose ? LISTING_PURPOSE_LABELS[f.purpose].toLowerCase() : "for rent and sale";
  return `${what} ${purpose} in ${placeName ?? "Sierra Leone"}`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseSearchParams(await searchParams);
  const qs = serializeSearchParams({ purpose: f.purpose, category: f.category, district: f.district, city: f.city });
  return {
    title: headline(f, null),
    description: "Search houses, apartments, land and commercial property across Sierra Leone with filters for price, bedrooms, water, power and more.",
    alternates: { canonical: `/properties${qs ? `?${qs}` : ""}` },
    // Deep filter combinations are not useful to index.
    robots: Object.keys(f).length > 3 ? { index: false, follow: true } : undefined,
  };
}

export default async function PropertiesPage({ searchParams }: Props) {
  const filters = parseSearchParams(await searchParams);
  const [actor, result, options] = await Promise.all([getCurrentActor(), searchProperties(filters), searchOptions()]);
  const saved = await savedIds(actor?.id, result.items.map((p) => p.id));
  const placeSlug = filters.locality ?? filters.city ?? filters.district;
  const place = placeSlug ? [...options.localities, ...options.cities, ...options.districts].find((o) => o.value === placeSlug)?.label ?? null : null;
  const view = filters.view === "list" ? "list" : "grid";
  const hrefFor = (page: number) => `/properties?${serializeSearchParams({ ...filters, page })}`;

  const chips: { label: string; without: Partial<SearchFilters> }[] = [];
  if (filters.purpose) chips.push({ label: LISTING_PURPOSE_LABELS[filters.purpose], without: { purpose: undefined } });
  if (filters.category) chips.push({ label: PROPERTY_CATEGORY_LABELS[filters.category], without: { category: undefined } });
  if (place) chips.push({ label: place, without: { district: undefined, city: undefined, locality: undefined } });
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) chips.push({ label: `Price ${filters.minPrice ?? 0}–${filters.maxPrice ?? "any"}`, without: { minPrice: undefined, maxPrice: undefined } });
  if (filters.beds) chips.push({ label: `${filters.beds}+ beds`, without: { beds: undefined } });
  if (filters.verified) chips.push({ label: "Documents reviewed", without: { verified: undefined } });
  for (const t of filters.type ?? []) chips.push({ label: options.types.find((o) => o.value === t)?.label ?? t, without: { type: filters.type!.filter((x) => x !== t) } });
  for (const a of filters.amenities ?? []) chips.push({ label: options.amenities.find((o) => o.value === a)?.label ?? a, without: { amenities: filters.amenities!.filter((x) => x !== a) } });

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/" className="hover:text-navy-900">Home</Link> <span aria-hidden>/</span> <span>Properties</span>
        </nav>
        <h1 className="mt-2 font-display text-3xl font-semibold text-navy-900 sm:text-4xl">{headline(filters, place)}</h1>
        <p className="mt-1 text-muted" aria-live="polite">
          {result.total === 0 ? "No properties match these filters" : `${result.total.toLocaleString("en")} ${result.total === 1 ? "property" : "properties"} found`}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <FilterPanel filters={filters} options={options} />
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ResultsToolbar filters={filters} />
            {actor && <SaveSearchButton query={serializeSearchParams({ ...filters, page: undefined, view: undefined })} defaultName={headline(filters, place)} />}
          </div>
          {chips.length > 0 && (
            <ul className="mb-5 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.label}>
                  <Link href={`/properties?${serializeSearchParams({ ...filters, ...c.without, page: undefined })}`} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-sm font-medium text-navy-800 ring-1 ring-navy-100 transition hover:bg-navy-100" aria-label={`Remove filter ${c.label}`}>
                    {c.label} <X className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/properties" className="inline-flex px-2 py-1.5 text-sm font-medium text-emerald-700 hover:underline">Clear all</Link>
              </li>
            </ul>
          )}
          {result.items.length ? (
            <div className={cn("grid gap-6", view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
              {result.items.map((p, i) => (
                <PropertyCard key={p.id} p={p} saved={saved.has(p.id)} layout={view} priority={i < 2} />
              ))}
            </div>
          ) : (
            <EmptyState title="No properties match your search" body="Try removing a filter, widening your price range or searching a nearby town." action={<ButtonLink href="/properties" variant="outline">Clear filters</ButtonLink>} />
          )}
          <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
        </div>
      </div>
      <CompareBar />
    </div>
  );
}
