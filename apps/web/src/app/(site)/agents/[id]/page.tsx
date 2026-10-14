import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDate, type VerificationKind } from "@sukkot/shared";
import { getCurrentActor } from "@/server/auth/actor";
import { publicAgentProfile } from "@/server/services/users";
import { listProperties } from "@/server/services/properties";
import { savedIds } from "@/server/services/favorites";
import { publicImageUrl } from "@/server/storage";
import { PropertyCard } from "@/components/property/property-card";
import { VerificationBadge } from "@/components/property/badges";
import { Avatar, EmptyState, Notice } from "@/components/ui/misc";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const u = await publicAgentProfile((await params).id);
  return { title: u ? `${u.profile?.fullName ?? "Agent"}` : "Profile not found" };
}

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await publicAgentProfile(id);
  if (!u) notFound();
  const [actor, listings] = await Promise.all([getCurrentActor(), listProperties({ listerId: u.id }, 24)]);
  const saved = await savedIds(actor?.id, listings.map((l) => l.id));
  const now = new Date();
  const badges = [...new Set(u.verificationRequests.filter((v) => !v.expiresAt || v.expiresAt > now).map((v) => v.kind as VerificationKind))];
  const name = u.profile?.fullName ?? "Lister";
  const agency = u.agencyMemberships[0]?.agency;
  return (
    <div className="container-page py-10">
      <section className="card mb-8 flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
        <Avatar name={name} url={u.profile?.avatarKey ? publicImageUrl(u.profile.avatarKey, 480) : null} size={96} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">{name}</h1>
          <p className="text-muted">
            {u.roles.some((r) => r.role === "AGENT") ? (agency ? `Agent at ${agency.name}` : "Independent agent") : "Property owner"} · member since {formatDate(u.createdAt)}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">
            {badges.length ? badges.map((b) => <VerificationBadge key={b} kind={b} />) : <span className="text-sm text-muted">Not yet verified</span>}
          </div>
          {u.profile?.bio && <p className="mt-3 max-w-2xl text-sm">{u.profile.bio}</p>}
        </div>
      </section>
      {u.isDemo && <Notice className="mb-6">This is a demonstration profile with fictional details.</Notice>}
      <h2 className="mb-4 text-xl font-bold text-navy-900">Live listings ({listings.length})</h2>
      {listings.length === 0 ? (
        <EmptyState title="No live listings" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((p) => <PropertyCard key={p.id} p={p} saved={saved.has(p.id)} />)}
        </div>
      )}
    </div>
  );
}
