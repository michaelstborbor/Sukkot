import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { publicImageUrl } from "@/server/storage";
import { VerificationBadge } from "@/components/property/badges";
import { Avatar, EmptyState, SectionHeading } from "@/components/ui/misc";
import type { VerificationKind } from "@sukkot/shared";

export const metadata: Metadata = { title: "Agents", description: "Find property agents across Sierra Leone." };
export const revalidate = 300;

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ verified?: string }> }) {
  const { verified } = await searchParams;
  const now = new Date();
  const agents = await db.user.findMany({
    where: {
      status: "ACTIVE",
      roles: { some: { role: "AGENT" } },
      ...(verified === "1" ? { verificationRequests: { some: { kind: "AGENT_CREDENTIALS", status: "VERIFIED", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } } : {}),
    },
    include: {
      profile: true,
      agencyMemberships: { include: { agency: { select: { name: true } } } },
      verificationRequests: { where: { status: "VERIFIED", propertyId: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { kind: true } },
      _count: { select: { listedProperties: { where: { listingStatus: "PUBLISHED" } } } },
    },
    orderBy: { createdAt: "asc" },
    take: 120,
  });
  return (
    <div className="container-page py-10 sm:py-14">
      <SectionHeading
        eyebrow="Professionals"
        title="Property agents"
        body="Agents who list on Sukkot Salone. Look for the Verified Agent badge, and always confirm who you are dealing with."
        action={
          <Link href={verified === "1" ? "/agents" : "/agents?verified=1"} className="link text-sm">
            {verified === "1" ? "Show all agents" : "Show verified agents only"}
          </Link>
        }
      />
      {agents.length === 0 ? (
        <EmptyState title="No agents found" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {agents.map((a) => {
            const name = a.profile?.fullName ?? "Agent";
            const badges = [...new Set(a.verificationRequests.map((v) => v.kind as VerificationKind))];
            return (
              <li key={a.id}>
                <Link href={`/agents/${a.id}`} className="card flex h-full flex-col items-center p-6 text-center transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                  <Avatar name={name} url={a.profile?.avatarKey ? publicImageUrl(a.profile.avatarKey, 480) : null} size={64} />
                  <p className="mt-3 font-semibold text-navy-900">{name}</p>
                  <p className="text-sm text-muted">{a.agencyMemberships[0]?.agency.name ?? "Independent agent"}</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-1">{badges.map((b) => <VerificationBadge key={b} kind={b} compact />)}</div>
                  <p className="mt-auto pt-3 text-xs text-muted">{a._count.listedProperties} live listings</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
