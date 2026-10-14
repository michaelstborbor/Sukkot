import { handler } from "@/server/http";
import { db } from "@/server/db";
import { publicImageUrl } from "@/server/storage";

export const GET = handler(async () => {
  const agents = await db.user.findMany({
    where: { status: "ACTIVE", roles: { some: { role: "AGENT" } } },
    include: { profile: true, agencyMemberships: { include: { agency: true } }, verificationRequests: { where: { status: "VERIFIED", propertyId: null }, select: { kind: true } }, _count: { select: { listedProperties: { where: { listingStatus: "PUBLISHED" } } } } },
    take: 100,
  });
  return {
    items: agents.map((a) => ({
      id: a.id,
      name: a.profile?.fullName ?? "Agent",
      avatarUrl: a.profile?.avatarKey ? publicImageUrl(a.profile.avatarKey, 480) : null,
      agency: a.agencyMemberships[0]?.agency.name ?? null,
      badges: a.verificationRequests.map((v) => v.kind),
      listings: a._count.listedProperties,
    })),
  };
});
