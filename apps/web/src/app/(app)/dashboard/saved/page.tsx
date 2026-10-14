import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Search } from "lucide-react";
import { formatDate } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { db } from "@/server/db";
import { listFavorites } from "@/server/services/favorites";
import { PageHeader } from "@/components/dashboard/shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { PropertyCard } from "@/components/property/property-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const actor = await requirePageActor("/dashboard/saved");
  const [favorites, searches] = await Promise.all([
    listFavorites(actor),
    db.savedSearch.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <>
      <PageHeader title="Saved" description="Properties you have saved and searches you want to come back to." />
      <section className="mb-10">
        <h2 className="mb-3 font-bold text-navy-900">Saved searches</h2>
        {searches.length === 0 ? (
          <p className="text-sm text-muted">Use &ldquo;Save search&rdquo; on the search page to keep a set of filters.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {searches.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                <Link href={`/properties?${s.queryString}`} className="flex min-w-0 items-center gap-2 font-medium hover:underline">
                  <Search className="h-4 w-4 shrink-0 text-muted" />
                  <span className="truncate">{s.name}</span>
                  <span className="hidden text-xs text-muted sm:inline">saved {formatDate(s.createdAt)}</span>
                </Link>
                <ActionButton path={`/saved-searches?id=${s.id}`} method="DELETE" label="Delete" variant="ghost" success="Search deleted" />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-bold text-navy-900">Saved properties</h2>
        {favorites.length === 0 ? (
          <EmptyState icon={<Heart className="h-6 w-6" />} title="Nothing saved yet" body="Tap the heart on any listing to save it here." action={<ButtonLink href="/properties">Browse properties</ButtonLink>} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((p) => <PropertyCard key={p.id} p={p} saved />)}
          </div>
        )}
      </section>
    </>
  );
}
