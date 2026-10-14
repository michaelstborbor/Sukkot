import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Eye, Heart, Inbox, Plus } from "lucide-react";
import { requirePagePermission } from "@/server/auth/actor";
import { myProperties, toSummary } from "@/server/services/properties";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PropertyImage } from "@/components/property/property-image";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "My properties" };

export default async function MyPropertiesPage() {
  const actor = await requirePagePermission("listing:create", "/dashboard/properties");
  const rows = await myProperties(actor);

  return (
    <>
      <PageHeader
        title="My properties"
        description="Drafts, listings under review and live listings. Listings go live only after a moderator approves them."
        actions={
          <ButtonLink href="/dashboard/properties/new" variant="accent">
            <Plus className="h-4 w-4" /> Add property
          </ButtonLink>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No properties yet"
          body="Create your first listing. It stays a private draft until you submit it for review."
          action={<ButtonLink href="/dashboard/properties/new">Add property</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const p = toSummary(row);
            return (
              <li key={p.id} className="card flex flex-col gap-4 p-3 sm:flex-row sm:items-center">
                <Link href={`/dashboard/properties/${p.id}`} className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-navy-50 sm:w-40">
                  <PropertyImage image={p.coverImage} sizes="160px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={row.listingStatus} kind="listing" />
                    {row.listingStatus === "PUBLISHED" && <StatusBadge status={row.availability} kind="availability" />}
                    <span className="text-xs text-muted">{p.reference}</span>
                  </div>
                  <Link href={`/dashboard/properties/${p.id}`} className="mt-1 block truncate font-semibold text-navy-900 hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {p.typeName} · {p.locationLabel} · <span className="font-semibold text-ink">{p.price.formatted}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {row.viewCount} views</span>
                    <span className="inline-flex items-center gap-1"><Inbox className="h-3.5 w-3.5" /> {row._count.enquiries} enquiries</span>
                    <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {row._count.savedBy} saves</span>
                    {row._count.offers > 0 && <span>{row._count.offers} offers</span>}
                    {row._count.applications > 0 && <span>{row._count.applications} applications</span>}
                  </p>
                </div>
                <div className="flex gap-2 sm:flex-col">
                  <ButtonLink href={`/dashboard/properties/${p.id}`} variant="outline" size="sm">Manage</ButtonLink>
                  {row.listingStatus === "PUBLISHED" && (
                    <ButtonLink href={`/properties/${p.slug}`} variant="ghost" size="sm">View live</ButtonLink>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
