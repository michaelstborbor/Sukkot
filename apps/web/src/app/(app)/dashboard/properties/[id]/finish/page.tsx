import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { formatDateTime, formatMoney, formatSlPhone, LISTING_PURPOSE_LABELS, listingMachine, NOTICES } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";
import { getManagedProperty, getPropertyDetail } from "@/server/services/properties";
import { publicImageUrl } from "@/server/storage";
import { getListingVideo, videoDto } from "@/server/services/video";
import { getSetting } from "@/server/services/settings";
import { openPhotoShoot } from "@/server/services/site-visits";
import { transferDetails } from "@/server/services/billing";
import { availableOnlineMethods } from "@/server/payments";
import { db } from "@/server/db";
import { CheckoutButton } from "@/components/dashboard/checkout";
import { PhotoChoice } from "@/components/dashboard/photo-choice";
import { TeamContactButtons } from "@/components/layout/team-contact";
import { PageHeader } from "@/components/dashboard/shell";
import { ListingSteps } from "@/components/dashboard/listing-steps";
import { PhotoManager } from "@/components/dashboard/media-manager";
import { ActionButton } from "@/components/dashboard/action-button";
import { PropertyImage } from "@/components/property/property-image";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Finish your listing" };

const LISTED_AS: Record<string, string> = {
  OWNER: "The owner",
  AGENT_FOR_OWNER: "The agent",
  AGENT_FOR_DEVELOPER: "An agent for a developer",
  DEVELOPER: "The developer",
  OTHER_AUTHORISED: "An authorised representative",
};

/** The last two steps of adding a property: photos and video, then review and submit for approval. */
export default async function FinishListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const review = (await searchParams).step === "review";
  const actor = await requirePageActor(`/dashboard/properties/${id}/finish`);
  const p = await getManagedProperty(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  });
  const isManager = p.listerId === actor.id || p.ownerId === actor.id;
  // Only a listing that can still be sent for approval goes through these steps.
  if (!isManager || !listingMachine.can(p.listingStatus, "submit", "OWNER")) redirect(`/dashboard/properties/${id}`);

  const manage = `/dashboard/properties/${id}`;
  const video = videoDto(await getListingVideo(p.id));

  const help = `Hello Sukkot Salone, I need help with my listing ${p.reference}: ${p.title}`;

  if (!review) {
    const [price, shoot] = await Promise.all([getSetting("visit.photoShoot"), openPhotoShoot(p.id)]);
    const fee = price ? formatMoney(BigInt(price.priceMinor), price.currency) : null;
    const photos = (
      <>
        <PhotoManager
          key={p.images.map((i) => i.id).join(",")}
          propertyId={p.id}
          images={p.images.map((i) => ({ id: i.id, thumbUrl: publicImageUrl(i.storageKey, 480), alt: i.alt ?? p.title, illustrative: i.illustrative }))}
          video={video}
        />
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <ButtonLink href={`${manage}?tab=details`} variant="outline"><ArrowLeft className="h-4 w-4" /> Back to details</ButtonLink>
          <ButtonLink href="?step=review">Next: review and submit <ArrowRight className="h-4 w-4" /></ButtonLink>
        </div>
      </>
    );

    if (shoot) {
      const paid = !!shoot.paymentId;
      const [methods, transfer] = paid || !price ? [[], null] : await Promise.all([availableOnlineMethods(), transferDetails()]);
      return (
        <div className="max-w-4xl space-y-6">
          <PageHeader title="Professional photos requested" description={`${p.reference} · ${p.title}`} />
          <ListingSteps current={2} />
          <section className="card space-y-3 p-5 sm:p-6">
            <Notice tone={paid ? "success" : "info"} title={shoot.status === "SCHEDULED" ? "Photo shoot booked" : paid ? "Paid, we will call you to agree a date" : "Request sent to our team"}>
              {shoot.status === "SCHEDULED" && shoot.scheduledAt
                ? `Our team will come on ${formatDateTime(shoot.scheduledAt)}.${shoot.staffNote ? ` ${shoot.staffNote}` : ""}`
                : `We will call you on ${shoot.contactPhone ? formatSlPhone(shoot.contactPhone) : "your number"}.`}{" "}
              Once the photos and video are on your listing, we let you know and you submit it for review.
            </Notice>
            {!paid && fee && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">The fee is <strong>{fee}</strong>, non-refundable. {shoot.payment?.status === "PENDING" ? "Your payment is being checked." : "It is not paid yet."}</p>
                {shoot.payment?.status !== "PENDING" && (
                  <CheckoutButton label={`Pay ${fee}`} title="Pay for professional photos" amountLabel={fee} methods={methods} transfer={transfer} purpose="PHOTO_SHOOT" propertyId={p.id} />
                )}
              </div>
            )}
          </section>
          <TeamContactButtons message={help} />
          <details className="card p-5 sm:p-6">
            <summary className="cursor-pointer font-semibold text-navy-900">Upload your own photos instead</summary>
            <div className="mt-4">{photos}</div>
          </details>
        </div>
      );
    }

    const me = await db.user.findUnique({ where: { id: actor.id }, select: { phone: true } });
    const defaultPhone = p.privateContactPhone ?? me?.phone;
    return (
      <div className="max-w-4xl space-y-6">
        <PageHeader title="Add photos or a video" description={`${p.reference} · ${p.title}`} />
        <ListingSteps current={2} />
        <PhotoChoice propertyId={p.id} fee={fee} defaultPhone={defaultPhone ? formatSlPhone(defaultPhone) : ""} hasPhotos={p.images.length > 0}>
          <div>{photos}</div>
        </PhotoChoice>
        <TeamContactButtons message={help} />
      </div>
    );
  }

  const d = (await getPropertyDetail(p.id, actor))!;
  const rows: [string, string | null][] = [
    ["Property type", d.typeName],
    ["Listing for", LISTING_PURPOSE_LABELS[d.purpose]],
    ["Price", `${d.price.formatted}${d.negotiable ? " (negotiable)" : ""}`],
    ["Location", d.district && !d.locationLabel.includes(d.district) ? `${d.locationLabel} · ${d.district}` : d.locationLabel],
    ["Bedrooms", d.bedrooms !== null ? String(d.bedrooms) : null],
    ["Bathrooms", d.bathrooms !== null ? String(d.bathrooms) : null],
    ["Floor area", d.floorArea],
    ["Plot size", d.plotSize],
    ["Listed as", LISTED_AS[d.listerCapacity] ?? null],
  ];
  const hasPhoto = d.images.length > 0;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Review and submit" description="Check everything reads right. A moderator reviews every listing before it goes live." />
      <ListingSteps current={3} />
      <section className="card overflow-hidden">
        {hasPhoto && (
          <div className="grid grid-cols-3 gap-1 bg-navy-50 sm:grid-cols-4">
            {d.images.slice(0, 4).map((img, i) => (
              <div key={img.id} className={i === 0 ? "col-span-3 row-span-2 aspect-[4/3] sm:col-span-2" : "aspect-[4/3]"}>
                <PropertyImage image={img} sizes="(min-width: 640px) 25vw, 33vw" />
              </div>
            ))}
          </div>
        )}
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="text-xs text-muted">{d.reference}</p>
            <h2 className="mt-1 text-xl font-bold text-navy-900">{d.title}</h2>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {rows
              .filter((r): r is [string, string] => !!r[1])
              .map(([k, val]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-navy-900">{val}</dd>
                </div>
              ))}
          </dl>
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Description</h3>
            <p className="mt-1 text-sm whitespace-pre-line">{d.description}</p>
          </div>
          <p className="text-sm text-muted">
            {d.images.length} photo{d.images.length === 1 ? "" : "s"}
            {d.video ? " and a video" : ""}
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <ButtonLink href={`${manage}?tab=details`} variant="outline" size="sm">Edit details</ButtonLink>
            <ButtonLink href="?" variant="outline" size="sm">Edit photos and video</ButtonLink>
          </div>
        </div>
      </section>

      {hasPhoto ? (
        <Notice className="mt-6">{NOTICES.verificationLimits}</Notice>
      ) : (
        <Notice tone="warning" className="mt-6">Add at least one photo before submitting. Listings with photos get far more enquiries.</Notice>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <ButtonLink href="?" variant="outline"><ArrowLeft className="h-4 w-4" /> Back to photos and video</ButtonLink>
        {hasPhoto && (
          <ActionButton path={`/properties/${p.id}/status`} body={{ action: "submit" }} label="Submit for review" variant="primary" size="md" success="Submitted for review" redirectTo={manage} />
        )}
      </div>
      <TeamContactButtons message={help} className="mt-6" />
    </div>
  );
}
