import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { db } from "@/server/db";
import { getCurrentActor } from "@/server/auth/actor";
import { listProperties } from "@/server/services/properties";
import { savedIds } from "@/server/services/favorites";
import { PropertyCard } from "@/components/property/property-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const revalidate = 120;

const PARAM: Record<string, string> = { PROVINCE: "province", DISTRICT: "district", CITY: "city", LOCALITY: "locality" };

async function load(slug: string) {
  const loc = await db.location.findFirst({ where: { slug, isActive: true }, include: { children: { where: { isActive: true }, orderBy: { name: "asc" } } } });
  if (!loc || loc.level === "COUNTRY") return null;
  const path = await db.location.findMany({ where: { id: { in: loc.pathIds }, level: { not: "COUNTRY" } } });
  return { loc, path: loc.pathIds.map((id) => path.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "Location not found" };
  return { title: `Property in ${data.loc.name}`, description: `Houses, apartments, land and commercial property for rent and sale in ${data.loc.name}, Sierra Leone.` };
}

export default async function LocationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { loc, path } = data;
  const [actor, listings] = await Promise.all([getCurrentActor(), listProperties({ listingStatus: "PUBLISHED", locationPathIds: { has: loc.id } }, 12)]);
  const saved = await savedIds(actor?.id, listings.map((l) => l.id));
  const searchHref = `/properties?${PARAM[loc.level]}=${loc.slug}`;
  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/locations" className="hover:text-ink">Locations</Link>
        {path.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            {p.id === loc.id ? <span className="text-ink">{p.name}</span> : <Link href={`/locations/${p.slug}`} className="hover:text-ink">{p.name}</Link>}
          </span>
        ))}
      </nav>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold text-navy-900">Property in {loc.name}</h1>
        </div>
        <ButtonLink href={searchHref}>Search with filters</ButtonLink>
      </div>
      {loc.children.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {loc.children.map((c) => (
            <Link key={c.id} href={`/locations/${c.slug}`} className="rounded-full border border-line bg-white px-3 py-1 text-sm hover:border-navy-600">{c.name}</Link>
          ))}
        </div>
      )}
      {listings.length === 0 ? (
        <EmptyState title={`No listings in ${loc.name} yet`} body="Check back soon, or save a search to be notified." action={<ButtonLink href="/properties">Browse all properties</ButtonLink>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((p) => <PropertyCard key={p.id} p={p} saved={saved.has(p.id)} />)}
        </div>
      )}
    </div>
  );
}
