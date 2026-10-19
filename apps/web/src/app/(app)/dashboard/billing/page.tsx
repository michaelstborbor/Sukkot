import type { Metadata } from "next";
import { Check } from "lucide-react";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { availableOnlineMethods, isAwaitingFinance, manualChannelOf } from "@/server/payments";
import { getEntitlements, transferDetails } from "@/server/services/billing";
import { getSetting } from "@/server/services/settings";
import { PageHeader } from "@/components/dashboard/shell";
import { CheckoutButton } from "@/components/dashboard/checkout";
import { ActionButton } from "@/components/dashboard/action-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Plans and billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ promote?: string }> }) {
  const actor = await requirePagePermission("listing:create", "/dashboard/billing");
  const { promote } = await searchParams;
  const [plans, subs, promoPrice, promoProperty, ent, transfer, myPlatformPayments, slotPrice] = await Promise.all([
    db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.subscription.findMany({ where: { userId: actor.id }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    getSetting("promotion.featured7d"),
    promote ? db.property.findFirst({ where: { id: promote, listingStatus: "PUBLISHED", OR: [{ listerId: actor.id }, { ownerId: actor.id }] }, select: { id: true, title: true, isFeatured: true } }) : null,
    getEntitlements(actor.id),
    transferDetails(),
    db.paymentTransaction.findMany({ where: { payerId: actor.id, payeeId: null, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 10 }),
    getSetting("listing.extraSlot"),
  ]);
  const methods = await availableOnlineMethods();
  const active = ent.subscription;
  const awaiting = myPlatformPayments.filter(isAwaitingFinance);
  const slotsLeft = Math.max(0, ent.featuredSlots - ent.featuredUsed);
  const queued = subs.filter((s) => s.status === "ACTIVE" && s.startsAt && s.startsAt > new Date());

  return (
    <>
      <PageHeader title="Plans and billing" description="Plans, promotions, inspection visits and extra listing slots are the only payments Sukkot Salone collects. Rent and sale money always goes directly between the parties." />
      {methods.length === 0 && !transfer && <Notice tone="warning" className="mb-6">Payments are not switched on for this site yet. An administrator needs to add Sukkot Salone&apos;s payment details or configure Orange Money or Afrimoney.</Notice>}

      <section className="card mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Your plan</p>
          <p className="mt-1 text-lg font-bold text-navy-900">{ent.plan?.name ?? "No plan"}</p>
          {active?.endsAt && <p className="text-sm text-muted">Paid until {formatDate(active.endsAt)}</p>}
          {queued.map((q) => <p key={q.id} className="text-sm text-muted">Renewed: {q.plan.name} from {formatDate(q.startsAt!)}</p>)}
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Active listings</p>
          <p className="mt-1 text-lg font-bold text-navy-900">
            {ent.activeListings}
            {ent.maxListings !== null && <span className="text-sm font-normal text-muted"> of {ent.maxListings}</span>}
          </p>
          {ent.extraSlots > 0 && <p className="text-sm text-muted">Includes {ent.extraSlots} extra slot{ent.extraSlots === 1 ? "" : "s"} you bought</p>}
          {ent.maxListings !== null && ent.activeListings >= ent.maxListings && <p className="text-sm text-amber-800">Limit reached. Upgrade, or buy one extra slot below.</p>}
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Included featured listings</p>
          <p className="mt-1 text-lg font-bold text-navy-900">
            {ent.featuredSlots ? <>{slotsLeft}<span className="text-sm font-normal text-muted"> of {ent.featuredSlots} left this period</span></> : "None on this plan"}
          </p>
        </div>
      </section>

      {awaiting.length > 0 && (
        <Notice tone="info" title="Waiting for our finance team" className="mb-6">
          <ul className="space-y-1">
            {awaiting.map((p) => (
              <li key={p.id}>
                {formatMoney(p.amountMinor, p.currency)} for {p.notes ?? "your purchase"} by {PAYMENT_METHOD_LABELS[manualChannelOf(p)!]}, transaction <span className="font-mono">{p.externalReference}</span>. It starts as soon as the payment is confirmed.
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {ent.maxListings !== null && slotPrice && (
        <section className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-navy-900">Need just one more listing?</h2>
            <p className="text-sm text-muted">Buy one extra listing slot for a one-off {formatMoney(BigInt(slotPrice.priceMinor), slotPrice.currency)}. It stays on your account and never expires, whatever plan you are on.</p>
          </div>
          <CheckoutButton
            label={`Buy a slot for ${formatMoney(BigInt(slotPrice.priceMinor), slotPrice.currency)}`}
            title="One extra listing slot"
            amountLabel={formatMoney(BigInt(slotPrice.priceMinor), slotPrice.currency)}
            methods={methods}
            transfer={transfer}
            purpose="LISTING_SLOT"
            variant="outline"
          />
        </section>
      )}

      {promoProperty && (
        <section className="card mb-8 flex flex-col gap-4 border-gold-500 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-navy-900">Feature &ldquo;{promoProperty.title}&rdquo; for 7 days</h2>
            <p className="text-sm text-muted">Appears in the homepage carousel and at the top of matching searches, marked &ldquo;Featured&rdquo;.{promoProperty.isFeatured && " It is featured now; another 7 days start when the current period ends."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {slotsLeft > 0 && (
              <ActionButton path="/billing/featured" body={{ propertyId: promoProperty.id }} label={`Use an included slot (${slotsLeft} left)`} variant="accent" size="md" success="Listing featured" />
            )}
            {promoPrice ? (
              <CheckoutButton
                label={`Pay ${formatMoney(BigInt(promoPrice.priceMinor), promoPrice.currency)}`}
                title="Feature this listing"
                amountLabel={formatMoney(BigInt(promoPrice.priceMinor), promoPrice.currency)}
                methods={methods}
                transfer={transfer}
                purpose="LISTING_PROMOTION"
                propertyId={promoProperty.id}
                variant={slotsLeft > 0 ? "outline" : "accent"}
              />
            ) : (
              slotsLeft === 0 && <p className="text-sm text-muted">Promotion is not on sale yet.</p>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = active?.planId === p.id || (!active && p.id === ent.plan?.id);
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
              {p.priceMinor > 0n ? (
                <div className="space-y-2">
                  {current && <StatusBadge status="ACTIVE" />}
                  <CheckoutButton
                    label={current ? "Renew for another period" : "Choose plan"}
                    title={`${p.name} plan`}
                    amountLabel={formatMoney(p.priceMinor, p.currency)}
                    methods={methods}
                    transfer={transfer}
                    purpose="PLATFORM_SUBSCRIPTION"
                    subscriptionPlanId={p.id}
                    variant={current ? "outline" : "primary"}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted">{current ? "Your current plan. " : ""}Included for every account.</p>
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
