import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime, formatMoney, formatSlPhone, SITE_VISIT_KIND_LABELS, SITE_VISIT_STATUS_LABELS, type SiteVisitStatus } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { publicImageUrl } from "@/server/storage";
import { listVisits } from "@/server/services/site-visits";
import { getListingVideo, videoDto } from "@/server/services/video";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm } from "@/components/dashboard/json-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { PhotoManager } from "@/components/dashboard/media-manager";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visits and photo shoots" };

const TONE: Record<SiteVisitStatus, "gold" | "verified" | "danger" | "neutral"> = { REQUESTED: "gold", SCHEDULED: "neutral", COMPLETED: "verified", CANCELLED: "danger" };

export default async function AdminVisitsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requirePagePermission("admin:listings.moderate", "/admin/visits");
  const { status } = await searchParams;
  const visits = await listVisits(actor, status);
  // Staff take the photos on the visit, so booked visits show the listing's photo manager.
  const media = new Map(
    await Promise.all(
      visits
        .filter((v) => v.status === "SCHEDULED")
        .map(async (v) => {
          const images = await db.propertyImage.findMany({ where: { propertyId: v.propertyId }, orderBy: { sortOrder: "asc" } });
          return [v.id, { images, video: videoDto(await getListingVideo(v.propertyId)) }] as const;
        }),
    ),
  );
  const tabs = [
    { key: undefined, label: "To do" },
    { key: "COMPLETED", label: "Inspected" },
    { key: "CANCELLED", label: "Cancelled" },
    { key: "ALL", label: "All" },
  ];

  return (
    <>
      <PageHeader title="Visits and photo shoots" description="Inspection visits: listers pay for staff to check the property matches the listing and take the photos and video; marking one done gives a dated &ldquo;Inspected by Sukkot&rdquo; badge for a year. Photo shoots: listers ask us to take the photos and video for a new listing; upload them here, then mark the shoot done." />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Status">
        {tabs.map((t) => (
          <Link key={t.label} href={t.key ? `?status=${t.key}` : "?"} className={cn("rounded-full px-3 py-1 text-sm font-medium", t.key === status ? "bg-navy-900 text-white" : "bg-surface ring-1 ring-line")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {visits.length === 0 ? (
        <EmptyState title="No visits here" body="Paid inspection visits appear here once the payment is confirmed. Photo shoot requests appear as soon as they are sent." />
      ) : (
        <ul className="space-y-4">
          {visits.map((v) => {
            const m = media.get(v.id);
            const open = v.status === "REQUESTED" || v.status === "SCHEDULED";
            const shoot = v.kind === "PHOTO_SHOOT";
            return (
              <li key={v.id} className="card space-y-3 p-5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/properties/${v.property.slug}`} className="font-semibold text-navy-900 hover:underline">{v.property.title}</Link>
                    <p className="text-muted">{v.property.reference} · {v.property.location.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={shoot ? "gold" : "neutral"}>{SITE_VISIT_KIND_LABELS[v.kind]}</Badge>
                    <Badge tone={TONE[v.status]}>{shoot && v.status === "REQUESTED" ? (v.payment ? "Paid, waiting for a date" : "Waiting for a date") : shoot && v.status === "COMPLETED" ? "Photos done" : SITE_VISIT_STATUS_LABELS[v.status]}</Badge>
                    {shoot && open && !v.payment && <Badge tone="danger">Not paid yet</Badge>}
                  </div>
                </div>
                <p>
                  Lister: {v.requester.profile?.fullName ?? v.requester.email} · {v.requester.email}
                  {(v.contactPhone ?? v.requester.phone) && <> · <a className="link" href={`tel:${v.contactPhone ?? v.requester.phone}`}>{formatSlPhone((v.contactPhone ?? v.requester.phone)!)}</a></>}
                </p>
                {v.requestNote && <p><strong>Lister&apos;s note:</strong> {v.requestNote}</p>}
                {shoot && !v.payment && <p className="text-muted">Requested {formatDateTime(v.createdAt)}. The lister pays from their listing page; you can still agree a date now.</p>}
                {v.payment && <p className="text-muted">Paid {formatMoney(v.payment.amountMinor, v.payment.currency)} · payment <span className="font-mono">{v.payment.reference}</span> · {formatDateTime(v.createdAt)}</p>}
                {v.scheduledAt && <p><strong>Visit:</strong> {formatDateTime(v.scheduledAt)}{v.staff?.profile?.fullName ? ` with ${v.staff.profile.fullName}` : ""}</p>}
                {v.staffNote && <p><strong>Notes:</strong> {v.staffNote}</p>}
                {v.cancelReason && <p><strong>Cancelled:</strong> {v.cancelReason}</p>}
                {v.status === "CANCELLED" && v.payment && v.payment.status !== "REFUNDED" && (
                  <Notice tone="warning">Refund the payment, then record it under <Link className="link" href={`/admin/payments?q=${v.payment.reference}`}>Payments</Link>.</Notice>
                )}

                {open && (
                  <details className="rounded-xl bg-navy-50 p-3" open={v.status === "REQUESTED"}>
                    <summary className="cursor-pointer font-semibold">{v.status === "REQUESTED" ? "Book the visit" : "Change the date"}</summary>
                    <div className="mt-3">
                      <JsonForm
                        path={`/admin/visits/${v.id}`}
                        extra={{ action: "schedule" }}
                        submitLabel="Save and tell the lister"
                        success="Visit booked"
                        fields={[
                          { name: "scheduledAt", label: "Date and time", type: "datetime-local" },
                          { name: "note", label: "Note for the lister", optional: true, placeholder: "Who will come, what to have ready", wide: true },
                        ]}
                      />
                    </div>
                  </details>
                )}

                {v.status === "SCHEDULED" && m && (
                  <details className="rounded-xl border border-line p-3">
                    <summary className="cursor-pointer font-semibold">Photos and video from the visit ({m.images.length} photo{m.images.length === 1 ? "" : "s"})</summary>
                    <div className="mt-3">
                      <PhotoManager
                        key={m.images.map((i) => i.id).join(",")}
                        propertyId={v.propertyId}
                        images={m.images.map((i) => ({ id: i.id, thumbUrl: publicImageUrl(i.storageKey, 480), alt: i.alt ?? v.property.title, illustrative: i.illustrative }))}
                        video={m.video}
                      />
                    </div>
                  </details>
                )}

                {v.status === "SCHEDULED" && (
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="mb-2 font-semibold">After the visit</p>
                    <JsonForm
                      path={`/admin/visits/${v.id}`}
                      extra={{ action: "complete" }}
                      columns={1}
                      submitLabel={shoot ? "Mark photos done" : "Mark inspected"}
                      success={shoot ? "Photo shoot done; the lister has been told" : "Listing marked inspected"}
                      fields={[
                        shoot
                          ? { name: "note", label: "Note for the lister", type: "textarea", placeholder: "12 photos and a one-minute video added. Check them, then submit the listing for review." }
                          : { name: "note", label: "What you checked (the lister sees this)", type: "textarea", placeholder: "Rooms, water and power match the listing. Photos and video taken on the day." },
                      ]}
                    />
                  </div>
                )}

                {open && (
                  <ActionButton
                    path={`/admin/visits/${v.id}`}
                    body={{ action: "cancel" }}
                    label="Cancel the visit"
                    variant="ghost"
                    reason={{ label: v.payment ? "Why is it cancelled? The lister sees this and is told the payment will be refunded." : "Why is it cancelled? The lister sees this.", required: true }}
                    success="Visit cancelled"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
