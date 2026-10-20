import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AVAILABILITY, AVAILABILITY_LABELS, formatDate, formatDateTime, formatMoney, INSPECTED_BADGE, inspectionStillValid, listingMachine, LISTING_STATUS_LABELS, SITE_VISIT_STATUS_LABELS } from "@sukkot/shared";
import { can, requirePageActor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";
import { getCatalog } from "@/server/services/catalog";
import { getManagedProperty } from "@/server/services/properties";
import { publicImageUrl } from "@/server/storage";
import { getListingVideo, videoDto } from "@/server/services/video";
import { visitsForListing } from "@/server/services/site-visits";
import { getSetting } from "@/server/services/settings";
import { getEntitlements, transferDetails } from "@/server/services/billing";
import { availableOnlineMethods } from "@/server/payments";
import { CheckoutButton } from "@/components/dashboard/checkout";
import { InspectedBadge } from "@/components/property/badges";
import { listingFormValues } from "@/server/listing-form-values";
import { PageHeader } from "@/components/dashboard/shell";
import { ListingForm } from "@/components/dashboard/listing-form";
import { DocumentManager, PhotoManager } from "@/components/dashboard/media-manager";
import { ActionButton } from "@/components/dashboard/action-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Manage listing" };

const TABS = [
  ["overview", "Status"],
  ["details", "Details"],
  ["photos", "Photos and video"],
  ["documents", "Documents"],
  ["history", "History"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function ManagePropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS.map((t) => t[0]) as string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "overview";
  const actor = await requirePageActor(`/dashboard/properties/${id}`);
  const p = await getManagedProperty(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  });
  const isManager = p.listerId === actor.id || p.ownerId === actor.id;
  // Super administrators can correct any listing's details and photos; the lister is told.
  const staffEdit = !isManager && can(actor, "admin:listings.edit");
  const canEdit = isManager || staffEdit;
  const latestModeration = p.statusHistory.find((h) => h.field === "listingStatus" && h.reason);
  const ownerActions = (["submit", "pause", "resume", "remove"] as const).filter((a) => listingMachine.can(p.listingStatus, a, "OWNER"));
  const canBookVisit = isManager && ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED"].includes(p.listingStatus);
  const [visits, visitPrice, transfer] = tab === "overview" && canBookVisit ? await Promise.all([visitsForListing(actor, p.id), getSetting("visit.inspection"), transferDetails()]) : [[], null, null];
  const ent = tab === "overview" && isManager && p.listingStatus === "PUBLISHED" ? await getEntitlements(actor.id) : null;
  const suggestionsLeft = ent ? Math.max(0, ent.suggestions - ent.suggestionsUsed) : 0;
  const openVisit = visits.find((v) => v.kind === "INSPECTION" && (v.status === "REQUESTED" || v.status === "SCHEDULED"));
  const inspected = inspectionStillValid(p.inspectedAt);

  return (
    <>
      <Link href="/dashboard/properties" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> My properties
      </Link>
      <PageHeader
        title={p.title}
        description={`${p.reference} · ${formatMoney(p.priceMinor, p.currency, { period: p.rentalPeriod })}`}
        actions={
          p.listingStatus === "PUBLISHED" ? (
            <ButtonLink href={`/properties/${p.slug}`} variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" /> View live listing
            </ButtonLink>
          ) : undefined
        }
      />

      {isManager && ownerActions.includes("submit") && (
        <Notice tone="info" className="mb-4" title="Finish your listing">
          Add photos or a video, then review and submit it for approval.{" "}
          <Link href={`/dashboard/properties/${p.id}/finish`} className="link font-semibold">Continue</Link>
        </Notice>
      )}

      <nav aria-label="Listing sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn("border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap", tab === key ? "border-navy-900 text-navy-900" : "border-transparent text-muted hover:text-ink")}
          >
            {label}
            {key === "photos" && <span className="ml-1 text-xs text-muted">({p.images.length})</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="card space-y-4 p-5">
            <h2 className="font-bold text-navy-900">Listing status</h2>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={p.listingStatus} kind="listing" />
              <StatusBadge status={p.availability} kind="availability" />
              <StatusBadge status={p.documentsStatus} kind="verification" />
            </div>
            {p.listingStatus === "DRAFT" && <Notice>This listing is a private draft. Add photos, then submit it for review. A moderator checks every listing before it goes live.</Notice>}
            {p.listingStatus === "PENDING_REVIEW" && <Notice tone="info">Waiting for a moderator. You will be notified when a decision is made.</Notice>}
            {(p.listingStatus === "CHANGES_REQUESTED" || p.listingStatus === "REJECTED" || p.listingStatus === "SUSPENDED") && latestModeration && (
              <Notice tone="warning" title={`Moderator note: ${LISTING_STATUS_LABELS[p.listingStatus]}`}>
                {latestModeration.reason}
              </Notice>
            )}
            {isManager && ownerActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ownerActions.includes("submit") && (
                  <ActionButton path={`/properties/${p.id}/status`} body={{ action: "submit" }} label="Submit for review" variant="primary" success="Submitted for review" />
                )}
                {ownerActions.includes("pause") && <ActionButton path={`/properties/${p.id}/status`} body={{ action: "pause" }} label="Pause listing" success="Listing paused" />}
                {ownerActions.includes("resume") && <ActionButton path={`/properties/${p.id}/status`} body={{ action: "resume" }} label="Resume listing" variant="secondary" success="Listing is live again" />}
                {ownerActions.includes("remove") && (
                  <ActionButton
                    path={`/properties/${p.id}/status`}
                    body={{ action: "remove" }}
                    label="Remove listing"
                    variant="danger"
                    confirm="The listing will be taken down permanently. Conversations and records are kept."
                    success="Listing removed"
                    redirectTo="/dashboard/properties"
                  />
                )}
              </div>
            )}
          </section>

          {isManager && p.listingStatus === "PUBLISHED" && (
            <section className="card space-y-4 p-5">
              <h2 className="font-bold text-navy-900">Availability</h2>
              <p className="text-sm text-muted">Keep this accurate. Marking a property as rented or sold stops new enquiries.</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABILITY.filter((a) => a !== p.availability).map((a) => (
                  <ActionButton key={a} path={`/properties/${p.id}/status`} body={{ availability: a }} label={`Mark ${AVAILABILITY_LABELS[a].toLowerCase()}`} success="Availability updated" />
                ))}
              </div>
            </section>
          )}

          {isManager && p.listingStatus === "PUBLISHED" && (
            <section className="card space-y-3 p-5">
              <h2 className="font-bold text-navy-900">Promote this listing</h2>
              <p className="text-sm text-muted">Featured listings appear in the homepage carousel and at the top of matching searches. Promotion never changes verification status.</p>
              {p.isFeatured ? <StatusBadge status="ACTIVE" /> : <ButtonLink href={`/dashboard/billing?promote=${p.id}`} variant="accent" size="sm">Feature for 7 days</ButtonLink>}
              {ent && ent.suggestions > 0 && (
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="text-sm text-muted">
                    Send this listing to people whose saved searches cover {p.location.name}. Your plan includes {ent.suggestions} suggestion{ent.suggestions === 1 ? "" : "s"} each period; {suggestionsLeft} left.
                  </p>
                  {suggestionsLeft > 0 && (
                    <ActionButton path="/billing/suggest" body={{ propertyId: p.id }} label="Suggest to people searching nearby" confirm="Send this listing to people searching in this area? This uses one of your suggestions." success="Suggestion sent" />
                  )}
                </div>
              )}
            </section>
          )}

          {canBookVisit && (
            <section className="card space-y-3 p-5">
              <h2 className="font-bold text-navy-900">{INSPECTED_BADGE.label}</h2>
              {inspected && (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <InspectedBadge date={p.inspectedAt!.toISOString()} /> Visited {formatDate(p.inspectedAt!)}. The badge shows for a year from the visit.
                </p>
              )}
              {openVisit ? (
                <Notice tone="info" title={SITE_VISIT_STATUS_LABELS[openVisit.status]}>
                  {openVisit.status === "SCHEDULED" && openVisit.scheduledAt
                    ? `Our staff will visit on ${formatDateTime(openVisit.scheduledAt)}.${openVisit.staffNote ? ` ${openVisit.staffNote}` : ""}`
                    : "We have your payment and will contact you to agree a date for the visit."}
                </Notice>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    Our staff visit the property, check it matches your listing, and take the photos and video for you. Renters see a dated &ldquo;{INSPECTED_BADGE.label}&rdquo; badge on the listing. {INSPECTED_BADGE.doesNotMean}
                  </p>
                  {visitPrice ? (
                    <CheckoutButton
                      label={`${inspected ? "Book a new visit" : "Book a visit"} for ${formatMoney(BigInt(visitPrice.priceMinor), visitPrice.currency)}`}
                      title="Book an inspection visit"
                      amountLabel={formatMoney(BigInt(visitPrice.priceMinor), visitPrice.currency)}
                      methods={await availableOnlineMethods()}
                      transfer={transfer}
                      purpose="INSPECTION_VISIT"
                      propertyId={p.id}
                      variant="secondary"
                    />
                  ) : (
                    <p className="text-sm text-muted">Inspection visits are not on sale yet.</p>
                  )}
                  <p className="text-xs text-muted">If we cannot make the visit, you get your money back. See the <Link href="/refunds" className="link">refund policy</Link>.</p>
                </>
              )}
            </section>
          )}

          <section className="card space-y-2 p-5 text-sm">
            <h2 className="font-bold text-navy-900">Performance</h2>
            <p>{p.viewCount} total views</p>
            <p>Created {formatDateTime(p.createdAt)}</p>
            {p.publishedAt && <p>Published {formatDateTime(p.publishedAt)}</p>}
            <p>Last updated {formatDateTime(p.updatedAt)}</p>
          </section>
        </div>
      )}

      {tab === "details" && (
        <div className="max-w-4xl">
          {staffEdit && <Notice tone="warning" className="mb-4">You are editing someone else&apos;s listing as an administrator. The lister is told when you save.</Notice>}
          {canEdit ? (
            <DetailsTab id={p.id} values={listingFormValues(p)} isAgent={isManager ? actor.roles.includes("AGENT") : p.listerCapacity !== "OWNER"} />
          ) : (
            <Notice>Only the lister can edit this listing.</Notice>
          )}
        </div>
      )}

      {tab === "photos" &&
        (canEdit ? (
          <PhotoManager
            key={p.images.map((i) => i.id).join(",")}
            propertyId={p.id}
            images={p.images.map((i) => ({ id: i.id, thumbUrl: publicImageUrl(i.storageKey, 480), alt: i.alt ?? p.title, illustrative: i.illustrative }))}
            video={videoDto(await getListingVideo(p.id))}
          />
        ) : (
          <Notice>Only the lister can change photos.</Notice>
        ))}

      {tab === "documents" && (
        <DocumentManager
          propertyId={p.id}
          canUpload={isManager}
          documents={p.documents.map((d) => ({ id: d.id, label: d.label, kind: d.kind, createdAt: d.createdAt.toISOString(), visibility: d.visibility }))}
        />
      )}

      {tab === "history" && (
        <ol className="card divide-y divide-line">
          {p.statusHistory.length === 0 && <li className="p-4 text-sm text-muted">No changes recorded yet.</li>}
          {p.statusHistory.map((h) => (
            <li key={h.id} className="p-4 text-sm">
              <p className="font-medium">
                {h.field === "details"
                  ? "Details edited by Sukkot Salone staff"
                  : h.field === "price"
                  ? `Price changed from ${formatMoney(BigInt(h.fromValue ?? "0"), p.currency)} to ${formatMoney(BigInt(h.toValue), p.currency)}`
                  : `${h.field === "availability" ? "Availability" : "Status"}: ${h.fromValue ? `${h.fromValue.replace(/_/g, " ").toLowerCase()} → ` : ""}${h.toValue.replace(/_/g, " ").toLowerCase()}`}
              </p>
              {h.reason && <p className="mt-1 text-muted">Reason: {h.reason}</p>}
              <p className="mt-1 text-xs text-muted">
                {formatDateTime(h.createdAt)}
                {h.actor?.profile?.fullName ? ` · ${h.actor.profile.fullName}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

async function DetailsTab({ id, values, isAgent }: { id: string; values: ReturnType<typeof listingFormValues>; isAgent: boolean }) {
  const catalog = await getCatalog();
  return <ListingForm catalog={catalog} initial={values} propertyId={id} isAgent={isAgent} />;
}
