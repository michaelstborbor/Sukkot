import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { formatDate } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { listOffers } from "@/server/services/offers";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState, Notice } from "@/components/ui/misc";
import { NOTICES } from "@sukkot/shared";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage() {
  const actor = await requirePageActor("/dashboard/offers");
  const rows = await listOffers(actor);
  return (
    <>
      <PageHeader title="Purchase offers" description="Offers you have made, and offers on properties you are selling." />
      <Notice className="mb-6">{NOTICES.offerNotLegal}</Notice>
      {rows.length === 0 ? (
        <EmptyState icon={<HandCoins className="h-6 w-6" />} title="No offers" body="Make an offer from any property listed for sale." />
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/dashboard/offers/${o.id}`} className="flex flex-col gap-1 p-4 hover:bg-navy-50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">{o.property.title}</p>
                  <p className="text-sm text-muted">
                    {o.myRole === "SELLER" ? `From ${o.buyer.name}` : "Your offer"} · <span className="font-semibold text-ink">{o.currentAmount.formatted}</span> (asking {o.askingPrice.formatted})
                    {o.expiresAt ? ` · expires ${formatDate(o.expiresAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} kind="offer" />
                  {o.actions.length > 0 && <span className="text-xs font-semibold text-gold-700">Your move</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
