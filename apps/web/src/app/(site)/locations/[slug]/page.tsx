import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Droplets, Zap } from "lucide-react";
import { db } from "@/server/db";
import { getCurrentActor } from "@/server/auth/actor";
import { listProperties } from "@/server/services/properties";
import { savedIds } from "@/server/services/favorites";
import { areaGuide, MIN_SAMPLE } from "@/server/services/area-guide";
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
  return { title: `Property in ${data.loc.name}`, description: `Rent ranges, water and power, and houses, apartments, land and commercial property for rent and sale in ${data.loc.name}, Sierra Leone.` };
}

export default async function LocationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { loc, path } = data;
  const [actor, listings, guide] = await Promise.all([getCurrentActor(), listProperties({ listingStatus: "PUBLISHED", locationPathIds: { has: loc.id } }, 12), areaGuide(loc.id)]);
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
            <Link key={c.id} href={`/locations/${c.slug}`} className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-navy-600">{c.name}</Link>
          ))}
        </div>
      )}
      <section aria-labelledby="area-guide" className="card mb-10 p-5 sm:p-6">
        <h2 id="area-guide" className="font-display text-2xl font-semibold text-navy-900">Living in {loc.name}</h2>
        <p className="mt-1 text-sm text-muted">
          Worked out from the homes listed here right now, so it changes as listings come and go. We show a figure once at least {MIN_SAMPLE} listings back it.
        </p>
        {guide.rents.length === 0 && guide.water.length === 0 && guide.power.length === 0 ? (
          <p className="mt-4 text-sm">There are not enough homes listed in {loc.name} yet to show rent ranges. Save a search to hear when new ones are listed.</p>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div>
              <h3 className="mb-2 font-semibold text-navy-900">Monthly rent asked</h3>
              {guide.rents.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-muted uppercase">
                      <tr>
                        <th scope="col" className="py-2 pr-3 font-semibold">Home</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">From</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Typical</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Up to</th>
                        <th scope="col" className="py-2 font-semibold">Listings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {guide.rents.map((r) => (
                        <tr key={r.label}>
                          <th scope="row" className="py-2 pr-3 font-medium">{r.label}</th>
                          <td className="py-2 pr-3">{r.low}</td>
                          <td className="py-2 pr-3 font-semibold text-navy-900">{r.median}</td>
                          <td className="py-2 pr-3">{r.high}</td>
                          <td className="py-2 text-muted">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-muted">Asking rents in Leones. Rents quoted per quarter, half year or year are shown per month. &ldquo;Typical&rdquo; is the middle price.</p>
                </div>
              ) : (
                <p className="text-sm text-muted">Not enough homes for rent are listed here yet.</p>
              )}
            </div>
            <div className="space-y-4 text-sm">
              {[
                { title: "Water", icon: Droplets, rows: guide.water },
                { title: "Power", icon: Zap, rows: guide.power },
              ].map((g) =>
                g.rows.length ? (
                  <div key={g.title}>
                    <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-navy-900"><g.icon className="h-4 w-4 text-emerald-700" aria-hidden />{g.title} in listed homes</h3>
                    <ul className="space-y-1">
                      {g.rows.map((r) => (
                        <li key={r.label} className="flex justify-between gap-3"><span>{r.label}</span><span className="text-muted">{r.percent}%</span></li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}
      </section>

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
