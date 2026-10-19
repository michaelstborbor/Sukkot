import type { Metadata } from "next";
import Link from "next/link";
import { AVAILABILITY_LABELS, LISTING_PURPOSE_LABELS } from "@sukkot/shared";
import { getSummariesByIds } from "@/server/services/properties";
import { PropertyImage } from "@/components/property/property-image";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Compare properties", robots: { index: false } };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const list = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const items = list.length ? await getSummariesByIds(list) : [];
  if (items.length === 0) {
    return (
      <div className="container-page py-14">
        <EmptyState title="Nothing to compare" body="Tick “Compare” on up to four listings to see them side by side." action={<ButtonLink href="/properties">Browse properties</ButtonLink>} />
      </div>
    );
  }
  const rows: [string, (p: (typeof items)[number]) => React.ReactNode][] = [
    ["Price", (p) => <strong>{p.price.formatted}</strong>],
    ["For", (p) => LISTING_PURPOSE_LABELS[p.purpose]],
    ["Type", (p) => p.typeName],
    ["Location", (p) => p.locationLabel],
    ["Bedrooms", (p) => p.bedrooms ?? "–"],
    ["Bathrooms", (p) => p.bathrooms ?? "–"],
    ["Floor area", (p) => p.floorArea ?? "–"],
    ["Plot size", (p) => p.plotSize ?? "–"],
    ["Availability", (p) => AVAILABILITY_LABELS[p.availability]],
    ["Lister verified", (p) => (p.listerVerified ? "Yes" : "No")],
    ["Documents reviewed", (p) => (p.documentsReviewed ? "Yes" : "No")],
    ["Negotiable", (p) => (p.negotiable ? "Yes" : "No")],
  ];
  return (
    <div className="container-page py-10">
      <h1 className="mb-6 font-display text-3xl font-semibold text-navy-900">Compare properties</h1>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="w-40 p-3" />
              {items.map((p) => (
                <th key={p.id} className="p-3 text-left align-top font-normal">
                  <Link href={`/properties/${p.slug}`} className="block">
                    <div className="relative mb-2 aspect-[4/3] overflow-hidden rounded-lg bg-navy-50">
                      <PropertyImage image={p.coverImage} sizes="240px" />
                    </div>
                    <span className="font-semibold text-navy-900 hover:underline">{p.title}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label} className="border-t border-line">
                <th scope="row" className="bg-canvas p-3 text-left font-semibold text-muted">{label}</th>
                {items.map((p) => <td key={p.id} className="p-3">{fn(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
