import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, Building, Car, Home } from "lucide-react";
import { STAY_KINDS, STAY_KIND_BLURBS, STAY_KIND_LABELS, STAY_KIND_PLURALS, type StayKind } from "@sukkot/shared";
import { db } from "@/server/db";
import { getSetting } from "@/server/services/settings";
import { listBookableStays } from "@/server/services/stays";
import { summaryInclude, toSummary } from "@/server/services/properties";
import { PropertyCard } from "@/components/property/property-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, SectionHeading } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Book hotels, guest houses, motels and short stays",
  description: "Book hotels, guest houses, motels and short-stay homes across Sierra Leone through Sukkot Salone. We confirm with the property, you pay us, and we send your receipt.",
};

const ICONS: Record<StayKind, typeof Building> = { HOTEL: Building, GUEST_HOUSE: BedDouble, MOTEL: Car, SHORT_STAY_HOME: Home };

export default async function StaysPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: raw } = await searchParams;
  const kind = STAY_KINDS.includes(raw as StayKind) ? (raw as StayKind) : undefined;
  const [stays, late] = await Promise.all([listBookableStays(kind), getSetting("stay.lateBooking")]);
  const rows = await db.property.findMany({ where: { id: { in: stays.map((s) => s.id) } }, include: summaryInclude });
  const byId = new Map(rows.map((r) => [r.id, toSummary(r)]));

  return (
    <div className="container-page py-10 sm:py-14">
      <SectionHeading
        as="h1"
        eyebrow="Book a stay"
        title="Hotels, guest houses, motels and short-stay homes"
        body={`Ask for your dates and we check with the property for you. Once they confirm, you pay Sukkot Salone and get a receipt with your room and the address. Book at least ${late.noticeDays} days ahead; later bookings are possible for ${late.surchargePercent}% more.`}
      />
      <nav aria-label="Kind of stay" className="mb-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Link href="/stays" className={cn("rounded-xl border p-3 text-sm font-semibold", !kind ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-surface hover:border-navy-600")}>
          All stays
        </Link>
        {STAY_KINDS.map((k) => {
          const Icon = ICONS[k];
          return (
            <Link key={k} href={`/stays?kind=${k}`} className={cn("rounded-xl border p-3", kind === k ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-surface hover:border-navy-600")}>
              <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4" aria-hidden />{STAY_KIND_PLURALS[k]}</span>
              <span className={cn("mt-0.5 block text-xs", kind === k ? "text-white/80" : "text-muted")}>{STAY_KIND_BLURBS[k]}</span>
            </Link>
          );
        })}
      </nav>
      {stays.length === 0 ? (
        <EmptyState
          title={kind ? `No ${STAY_KIND_PLURALS[kind].toLowerCase()} taking bookings yet` : "No places taking bookings yet"}
          body="We are adding places all the time. You can still browse every short-stay listing and contact the lister."
          action={<Link href="/properties?purpose=SHORT_STAY" className={buttonClasses("secondary")}>See all short-stay listings</Link>}
        />
      ) : (
        <>
          <h2 className="sr-only">Places you can book</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stays.map((s) => {
            const p = byId.get(s.id);
            if (!p) return null;
            return (
              <div key={s.id} className="flex flex-col gap-2">
                <PropertyCard p={p} />
                <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                  <span>
                    <strong>{STAY_KIND_LABELS[s.kind]}</strong>
                    {s.details?.starRating ? ` · ${"★".repeat(s.details.starRating)}` : ""} · from <strong>{s.fromNightly}</strong> a night
                  </span>
                  <Link href={`/stays/${p.slug}/book`} className={buttonClasses("primary", "sm")}>Book</Link>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
      <p className="mt-10 text-sm text-muted">
        Looking for something else? <Link href="/properties?purpose=SHORT_STAY" className="link">See all short-stay listings</Link>, including places that take enquiries rather than bookings.
      </p>
    </div>
  );
}
