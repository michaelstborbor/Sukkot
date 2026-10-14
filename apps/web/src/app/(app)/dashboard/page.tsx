import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarClock, FileText, HandCoins, Heart, Inbox, MessageSquare, Plus } from "lucide-react";
import { hasPermission, relativeTime } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { listerOverview, seekerOverview } from "@/server/services/dashboard";
import { PageHeader } from "@/components/dashboard/shell";
import { ActivityChart, IncomeChart } from "@/components/dashboard/charts";
import { ButtonLink } from "@/components/ui/button";
import { Notice, Stat } from "@/components/ui/misc";
import { ActionButton } from "@/components/dashboard/action-button";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const actor = await requirePageActor("/dashboard");
  const { denied } = await searchParams;
  const lister = hasPermission(actor.roles, "listing:create");
  const seeker = await seekerOverview(actor);
  const first = actor.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Hello, ${first}`} description="Here is what is happening with your property search and listings." actions={lister ? <ButtonLink href="/dashboard/properties/new" variant="accent"><Plus className="h-4 w-4" /> Add property</ButtonLink> : undefined} />
      {denied && <Notice tone="warning" className="mb-6">You don&apos;t have access to that page.</Notice>}

      {lister && <ListerSection actorId={actor.id} />}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-navy-900">{lister ? "Your activity as a tenant or buyer" : "Your activity"}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Saved" value={seeker.saved} icon={<Heart className="h-4 w-4" />} href="/dashboard/saved" />
          <Stat label="Enquiries" value={seeker.enquiries} icon={<Inbox className="h-4 w-4" />} href="/dashboard/messages" />
          <Stat label="Unread" value={seeker.unread} icon={<MessageSquare className="h-4 w-4" />} href="/dashboard/messages" />
          <Stat label="Inspections" value={seeker.inspections} icon={<CalendarClock className="h-4 w-4" />} href="/dashboard/inspections" />
          <Stat label="Applications" value={seeker.applications} icon={<FileText className="h-4 w-4" />} href="/dashboard/applications" />
          <Stat label="Offers" value={seeker.offers} icon={<HandCoins className="h-4 w-4" />} href="/dashboard/offers" />
        </div>
      </section>

      {!lister && (
        <section className="card mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-navy-900">Have a property to rent or sell?</h2>
            <p className="text-sm text-muted">Switch on landlord tools to list property and manage enquiries.</p>
          </div>
          <div className="flex gap-2">
            <ActionButton path="/me/roles" body={{ role: "OWNER" }} label="I'm a landlord or owner" variant="secondary" success="Landlord tools enabled" redirectTo="/dashboard/properties/new" />
            <ActionButton path="/me/roles" body={{ role: "AGENT" }} label="I'm an agent" success="Agent tools enabled" />
          </div>
        </section>
      )}
    </>
  );
}

async function ListerSection({ actorId }: { actorId: string }) {
  const actor = await requirePageActor();
  const o = await listerOverview({ ...actor, id: actorId });
  const t = o.totals;
  return (
    <section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <Stat label="Listings" value={t.listings} hint={`${t.drafts} drafts`} icon={<Building2 className="h-4 w-4" />} href="/dashboard/properties" />
        <Stat label="Live" value={t.active} hint={`${t.pending} awaiting review`} href="/dashboard/properties" />
        <Stat label="Rented or sold" value={t.rentedOrSold} />
        <Stat label="Enquiries" value={t.enquiries} hint={t.conversionRate !== null ? `${t.conversionRate}% of views (6 mo)` : undefined} href="/dashboard/enquiries" />
        <Stat label="Unread messages" value={t.unread} href="/dashboard/messages" />
        <Stat label="Upcoming inspections" value={t.upcomingInspections} href="/dashboard/inspections" />
        <Stat label="Pending applications" value={t.pendingApplications} href="/dashboard/applications" />
        <Stat label="Active negotiations" value={t.activeOffers} href="/dashboard/offers" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-bold text-navy-900">Views and enquiries</h2>
          <ActivityChart data={o.series} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-bold text-navy-900">Recorded income (SLE)</h2>
          <IncomeChart data={o.series} />
        </div>
      </div>
      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-bold text-navy-900">Recent activity</h2>
        {o.recent.length ? (
          <ul className="divide-y divide-line text-sm">
            {o.recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <Link href={`/dashboard/properties/${r.property.id}`} className="font-medium text-navy-900 hover:underline">{r.property.reference}</Link>{" "}
                  {r.field === "listingStatus" ? "status" : r.field} changed to <strong>{r.toValue.replace(/_/g, " ").toLowerCase()}</strong>
                  {r.reason ? ` – ${r.reason}` : ""}
                </span>
                <span className="text-xs text-muted">{relativeTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No activity yet.</p>
        )}
      </div>
    </section>
  );
}
