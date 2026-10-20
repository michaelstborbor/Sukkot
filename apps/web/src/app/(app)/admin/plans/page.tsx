import type { Metadata } from "next";
import { formatMoney, minorToMajorString } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm, type JsonField } from "@/components/dashboard/json-form";
import { Badge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Plans" };

function fields(p?: { code: string; name: string; audience: string; description: string; priceMinor: bigint; currency: string; periodDays: number; maxListings: number | null; featuredSlots: number; searchBoost: number; areaSuggestions: number; features: string[]; isActive: boolean }): JsonField[] {
  return [
    { name: "code", label: "Code", defaultValue: p?.code ?? "", hint: "Lowercase letters, numbers, dashes. Same code updates the plan." },
    { name: "name", label: "Name", defaultValue: p?.name ?? "" },
    { name: "audience", label: "For", type: "select", defaultValue: p?.audience ?? "LANDLORD", options: [{ value: "LANDLORD", label: "Landlords" }, { value: "AGENT", label: "Agents" }, { value: "AGENCY", label: "Agencies" }] },
    { name: "currency", label: "Currency", type: "select", defaultValue: p?.currency ?? "SLE", options: [{ value: "SLE", label: "SLE" }, { value: "USD", label: "USD" }] },
    { name: "price", label: "Price", defaultValue: p ? minorToMajorString(p.priceMinor, p.currency as "SLE") : "0", hint: "0 for a free plan" },
    { name: "periodDays", label: "Period (days)", type: "number", defaultValue: String(p?.periodDays ?? 30) },
    { name: "maxListings", label: "Listing limit", type: "number", optional: true, defaultValue: p?.maxListings ? String(p.maxListings) : "" },
    { name: "featuredSlots", label: "Featured slots", type: "number", defaultValue: String(p?.featuredSlots ?? 0) },
    { name: "searchBoost", label: "Search lift", type: "number", defaultValue: String(p?.searchBoost ?? 0), hint: "0 for none. Listings of higher-lift plans show first in search, after featured listings." },
    { name: "areaSuggestions", label: "Area suggestions per period", type: "number", defaultValue: String(p?.areaSuggestions ?? 0), hint: "Listings the subscriber can send to people searching in that area." },
    { name: "description", label: "Description", type: "textarea", defaultValue: p?.description ?? "" },
    { name: "features", label: "Features (one per line)", type: "list", defaultValue: p?.features.join("\n") ?? "" },
    { name: "isActive", label: "Plan is on sale", type: "checkbox", defaultValue: p?.isActive ?? true, wide: true },
  ];
}

export default async function AdminPlansPage() {
  await requirePagePermission("admin:plans.manage", "/admin/plans");
  const plans = await db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } } } });
  return (
    <>
      <PageHeader title="Subscription plans" description="Prices are charged exactly as set here. Changes apply to new purchases only." />
      <div className="space-y-4">
        {plans.map((p) => (
          <details key={p.id} className="card p-5">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{p.name} <span className="font-normal text-muted">· {p.priceMinor === 0n ? "Free" : formatMoney(p.priceMinor, p.currency)}</span></span>
              <span className="flex gap-2">{!p.isActive && <Badge tone="warning">Not on sale</Badge>}<Badge>{p._count.subscriptions} active</Badge></span>
            </summary>
            <div className="mt-4"><JsonForm path="/admin/plans" fields={fields(p)} success="Plan saved" /></div>
          </details>
        ))}
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">New plan</h2>
          <JsonForm path="/admin/plans" fields={fields()} success="Plan created" submitLabel="Create plan" />
        </section>
      </div>
    </>
  );
}
