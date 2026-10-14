import type { Metadata } from "next";
import { Check } from "lucide-react";
import { formatDate, formatMoney } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { availableOnlineMethods } from "@/server/payments";
import { getSetting } from "@/server/services/settings";
import { PageHeader } from "@/components/dashboard/shell";
import { CheckoutButton } from "@/components/dashboard/checkout";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Plans and billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ promote?: string }> }) {
  const actor = await requirePagePermission("listing:create", "/dashboard/billing");
  const { promote } = await searchParams;
  const [plans, subs, promoPrice, promoProperty] = await Promise.all([
    db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.subscription.findMany({ where: { userId: actor.id }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    getSetting("promotion.featured7d"),
    promote ? db.property.findFirst({ where: { id: promote, listingStatus: "PUBLISHED", OR: [{ listerId: actor.id }, { ownerId: actor.id }] }, select: { id: true, title: true, isFeatured: true } }) : null,
  ]);
  const methods = availableOnlineMethods();
  const active = subs.find((s) => s.status === "ACTIVE" && (!s.endsAt || s.endsAt > new Date()));

  return (
    <>
      <PageHeader title="Plans and billing" description="Plans and promotions are the only payments Sukkot Salone collects. Rent and sale money always goes directly between the parties." />
      {methods.length === 0 && <Notice tone="warning" className="mb-6">Online payments are not switched on for this site yet. An administrator needs to configure Orange Money or Afrimoney.</Notice>}

      {promoProperty && (
        <section className="card mb-8 flex flex-col gap-4 border-gold-500 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-navy-900">Feature &ldquo;{promoProperty.title}&rdquo; for 7 days</h2>
            <p className="text-sm text-muted">Appears in the homepage carousel and at the top of matching searches, marked &ldquo;Featured&rdquo;.</p>
          </div>
          {promoProperty.isFeatured ? (
            <StatusBadge status="ACTIVE" />
          ) : promoPrice ? (
            <CheckoutButton
              label={`Pay ${formatMoney(BigInt(promoPrice.priceMinor), promoPrice.currency)}`}
              title="Feature this listing"
              amountLabel={formatMoney(BigInt(promoPrice.priceMinor), promoPrice.currency)}
              methods={methods}
              purpose="LISTING_PROMOTION"
              propertyId={promoProperty.id}
              variant="accent"
            />
          ) : (
            <p className="text-sm text-muted">Promotion is not on sale yet.</p>
          )}
        </section>
      )}

      {active && (
        <Notice tone="success" className="mb-6">
          You are on the <strong>{active.plan.name}</strong> plan{active.endsAt ? ` until ${formatDate(active.endsAt)}` : ""}.
        </Notice>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = active?.planId === p.id;
          return (
            <section key={p.id} className={`card flex flex-col p-5 ${current ? "ring-2 ring-emerald-600" : ""}`}>
              <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase">{p.audience}</p>
              <h2 className="mt-1 text-xl font-bold text-navy-900">{p.name}</h2>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <p className="mt-4 text-2xl font-bold text-navy-900">
                {p.priceMinor === 0n ? "Free" : formatMoney(p.priceMinor, p.currency)}
                {p.priceMinor > 0n && <span className="text-sm font-normal text-muted"> / {p.periodDays} days</span>}
              </p>
              <ul className="my-4 flex-1 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> {f}</li>
                ))}
              </ul>
              {current ? (
                <StatusBadge status="ACTIVE" />
              ) : p.priceMinor > 0n ? (
                <CheckoutButton label="Choose plan" title={`${p.name} plan`} amountLabel={formatMoney(p.priceMinor, p.currency)} methods={methods} purpose="PLATFORM_SUBSCRIPTION" subscriptionPlanId={p.id} />
              ) : (
                <p className="text-sm text-muted">Included for every account.</p>
              )}
            </section>
          );
        })}
      </div>

      {subs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-bold text-navy-900">Subscription history</h2>
          <ul className="card divide-y divide-line text-sm">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3">
                <span>{s.plan.name}{s.startsAt ? ` · ${formatDate(s.startsAt)}${s.endsAt ? ` to ${formatDate(s.endsAt)}` : ""}` : ""}</span>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
