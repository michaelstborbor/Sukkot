import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { env } from "@/server/env";

// Rendered on request so builds do not need a database connection.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;
  const [properties, locations, agents] = await Promise.all([
    db.property.findMany({ where: { listingStatus: "PUBLISHED", isDemo: false }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5000 }),
    db.location.findMany({ where: { isActive: true, level: { in: ["DISTRICT", "CITY", "LOCALITY"] } }, select: { slug: true } }),
    db.user.findMany({ where: { status: "ACTIVE", isDemo: false, roles: { some: { role: "AGENT" } } }, select: { id: true, updatedAt: true }, take: 2000 }),
  ]);
  const staticPaths = ["", "/properties", "/locations", "/agents", "/list-your-property", "/verification", "/safety", "/help", "/about", "/privacy", "/terms"];
  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.6 })),
    ...properties.map((p) => ({ url: `${base}/properties/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...locations.map((l) => ({ url: `${base}/locations/${l.slug}`, changeFrequency: "daily" as const, priority: 0.5 })),
    ...agents.map((a) => ({ url: `${base}/agents/${a.id}`, lastModified: a.updatedAt, priority: 0.4 })),
  ];
}
