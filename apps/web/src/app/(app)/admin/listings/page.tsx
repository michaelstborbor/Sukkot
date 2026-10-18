import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime, formatMoney, LISTING_STATUSES, LISTING_STATUS_LABELS, listingMachine, type ListingStatus } from "@sukkot/shared";
import { requirePagePermission, can } from "@/server/auth/actor";
import { db } from "@/server/db";
import { publicImageUrl } from "@/server/storage";
import { PageHeader } from "@/components/dashboard/shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Listing moderation" };

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const actor = await requirePagePermission("admin:listings.moderate", "/admin/listings");
  const sp = await searchParams;
  const status = (LISTING_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as ListingStatus) : "PENDING_REVIEW";
  const q = sp.q?.trim();
  const rows = await db.property.findMany({
    where: { listingStatus: status, ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] } : {}) },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 4 },
      lister: { select: { id: true, email: true, isDemo: true, profile: { select: { fullName: true } }, verificationRequests: { where: { status: "VERIFIED" }, select: { kind: true } } } },
      location: { select: { name: true } },
      propertyType: { select: { name: true } },
      _count: { select: { documents: true, reports: true } },
    },
    orderBy: status === "PENDING_REVIEW" ? { updatedAt: "asc" } : { updatedAt: "desc" },
    take: 50,
  });
  const canReviewDocs = can(actor, "admin:verification.review");
  const canEdit = can(actor, "admin:listings.edit");
  const tabs: ListingStatus[] = ["PENDING_REVIEW", "PUBLISHED", "CHANGES_REQUESTED", "SUSPENDED", "REJECTED", "PAUSED", "DRAFT", "REMOVED"];

  return (
    <>
      <PageHeader title="Listing moderation" description="Check each listing for accuracy, duplicates, misleading photos and signs of fraud before it goes live." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1" aria-label="Status">
          {tabs.map((t) => (
            <Link key={t} href={`?status=${t}`} aria-current={t === status ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-sm font-medium", t === status ? "bg-navy-900 text-white" : "bg-white text-ink ring-1 ring-line hover:bg-navy-50")}>
              {LISTING_STATUS_LABELS[t]}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Title or reference" aria-label="Search listings" className="h-9 rounded-lg border border-line px-3 text-sm" />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nothing here" body="No listings with this status." />
      ) : (
        <ul className="space-y-4">
          {rows.map((p) => {
            const can = (a: Parameters<typeof listingMachine.can>[1]) => listingMachine.can(p.listingStatus, a, "MODERATOR");
            return (
              <li key={p.id} className="card p-4">
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="grid w-full shrink-0 grid-cols-4 gap-1 lg:w-72 lg:grid-cols-2">
                    {p.images.map((i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i.id} src={publicImageUrl(i.storageKey, 480)} alt="" className="aspect-[4/3] w-full rounded object-cover" loading="lazy" />
                    ))}
                    {p.images.length === 0 && <div className="col-span-4 rounded bg-danger-50 p-3 text-xs text-danger lg:col-span-2">No photos</div>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={p.listingStatus} kind="listing" />
                      {p.isDemo && <Badge tone="warning">Demo</Badge>}
                      {p._count.reports > 0 && <Badge tone="danger">{p._count.reports} reports</Badge>}
                      <Badge>{p._count.documents} documents</Badge>
                      <Badge>{p.listerCapacity.replace(/_/g, " ").toLowerCase()}</Badge>
                    </div>
                    <p className="text-base font-semibold text-navy-900">{p.title}</p>
                    <p className="text-muted">
                      {p.reference} · {p.propertyType.name} · {p.location.name} · {formatMoney(p.priceMinor, p.currency, { period: p.rentalPeriod })}
                    </p>
                    <p className="text-muted">
                      Lister: {p.lister.profile?.fullName ?? p.lister.email} ({p.lister.email})
                      {p.lister.verificationRequests.length ? ` · verified: ${p.lister.verificationRequests.map((v) => v.kind.toLowerCase()).join(", ")}` : " · not verified"}
                    </p>
                    <p className="line-clamp-3 text-ink">{p.description}</p>
                    <p className="text-xs text-muted">Updated {formatDateTime(p.updatedAt)}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link href={`/dashboard/properties/${p.id}?tab=documents`} className="link text-sm">Documents and history</Link>
                      {p.listingStatus === "PUBLISHED" && <Link href={`/properties/${p.slug}`} className="link text-sm">View live</Link>}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  {can("approve") && <ActionButton path={`/admin/listings/${p.id}`} body={{ action: "approve" }} label="Approve" variant="secondary" success="Approved and published" />}
                  {can("approve") && canReviewDocs && p._count.documents > 0 && (
                    <ActionButton path={`/admin/listings/${p.id}`} body={{ action: "approve", markDocumentsReviewed: true }} label="Approve and mark documents reviewed" success="Approved" />
                  )}
                  {can("request_changes") && <ActionButton path={`/admin/listings/${p.id}`} body={{ action: "request_changes" }} label="Request changes" reason={{ label: "What needs to change?", required: true }} success="Changes requested" />}
                  {can("reject") && <ActionButton path={`/admin/listings/${p.id}`} body={{ action: "reject" }} label="Reject" variant="danger" reason={{ label: "Reason for rejection", required: true }} success="Rejected" />}
                  {can("suspend") && <ActionButton path={`/admin/listings/${p.id}`} body={{ action: "suspend" }} label="Suspend" variant="danger" reason={{ label: "Reason for suspension", required: true }} success="Suspended" />}
                  {can("reinstate") && <ActionButton path={`/admin/listings/${p.id}`} body={{ action: "reinstate" }} label="Reinstate" reason={{ label: "Note" }} success="Reinstated" />}
                  {p.listingStatus === "PUBLISHED" && (
                    <ActionButton path={`/admin/listings/${p.id}/feature`} body={{ featured: !p.isFeatured }} label={p.isFeatured ? "Unfeature" : "Feature"} variant="ghost" success="Updated" />
                  )}
                  {canEdit && p.listingStatus !== "REMOVED" && p.listingStatus !== "SUSPENDED" && (
                    <ButtonLink href={`/dashboard/properties/${p.id}?tab=details`} variant="outline" size="sm">
                      <Pencil className="h-4 w-4" /> Edit
                    </ButtonLink>
                  )}
                  {can("remove") && (
                    <ActionButton path={`/admin/listings/${p.id}`} body={{ action: "remove" }} label="Remove" variant="danger" confirm="The listing comes off the site and the lister is told why. Its record, messages and payments are kept." reason={{ label: "Reason for removal", required: true }} success="Removed" />
                  )}
                  {canEdit && (
                    <ActionButton
                      path={`/admin/listings/${p.id}`}
                      method="DELETE"
                      label="Delete permanently"
                      variant="danger"
                      confirm={`This deletes ${p.reference} with its photos, video, documents and enquiries. It cannot be undone. Payment records are kept.`}
                      reason={{ label: "Reason for deleting", required: true }}
                      success="Deleted"
                    />
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
