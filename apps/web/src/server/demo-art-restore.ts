import "server-only";
import { demoSvg, type DemoKind } from "../../prisma/demo-art";
import { db } from "./db";
import { storage } from "./storage";

const KIND_BY_CATEGORY: Record<string, DemoKind> = { HOUSE: "house", APARTMENT: "apartment", LAND: "land", COMMERCIAL: "commercial", SHORT_STAY: "shortstay", OTHER: "house" };

/**
 * Redraw illustrative demo artwork whose file has gone missing (for example on a host that wiped its
 * disk before files were kept in the database). The artwork is generated, so nothing real is lost.
 * Real photos cannot be redrawn; listers upload those again. Returns how many images were redrawn.
 */
export async function restoreDemoArtwork(limit = 300) {
  const rows = await db.propertyImage.findMany({
    where: { illustrative: true, storageKey: { startsWith: "demo/", endsWith: ".svg" } },
    take: limit,
    select: { storageKey: true, sortOrder: true, property: { select: { title: true, propertyType: { select: { slug: true, category: true } } } } },
  });
  let done = 0;
  for (const [i, row] of rows.entries()) {
    if (await storage().get(row.storageKey, "public")) continue;
    const kind = row.property.propertyType.slug === "agricultural-land" ? "farm" : (KIND_BY_CATEGORY[row.property.propertyType.category] ?? "house");
    await storage().put(row.storageKey, Buffer.from(demoSvg(kind, i + row.sortOrder + 1, row.property.title)), "image/svg+xml", "public");
    done++;
  }
  return done;
}
