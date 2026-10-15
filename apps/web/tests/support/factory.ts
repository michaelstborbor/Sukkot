import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { Role } from "@sukkot/shared";
import { db } from "@/server/db";
import type { Actor } from "@/server/auth/session";

const uid = () => randomBytes(4).toString("hex");

export async function makeUser(roles: Role[] = ["USER"], name = "Test User"): Promise<Actor> {
  const email = `t-${uid()}@test.sukkot.sl`;
  const user = await db.user.create({
    data: { email, passwordHash: "x", profile: { create: { fullName: name } }, roles: { create: [...new Set<Role>(["USER", ...roles])].map((role) => ({ role })) } },
    include: { roles: true },
  });
  return { id: user.id, email, name, roles: user.roles.map((r) => r.role), sessionId: "test", isDemo: false };
}

export async function refs() {
  const [house, land, freetown] = await Promise.all([
    db.propertyType.findUniqueOrThrow({ where: { slug: "house" } }),
    db.propertyType.findUniqueOrThrow({ where: { slug: "empty-land" } }),
    db.location.findFirstOrThrow({ where: { level: "LOCALITY" } }),
  ]);
  return { house, land, locality: freetown };
}

export async function houseInput(overrides: Record<string, unknown> = {}) {
  const { house, locality } = await refs();
  return {
    title: `Test house ${uid()} with garden`,
    description: "A well kept three bedroom house with a garden, borehole water and a solar backup system.",
    propertyTypeId: house.id,
    purpose: "RENT",
    price: "12000",
    currency: "SLE",
    rentalPeriod: "MONTH",
    bedrooms: 3,
    bathrooms: 2,
    locationId: locality.id,
    listerCapacity: "OWNER",
    ...overrides,
  };
}

export async function pngFile(name = "photo.png") {
  const buf = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 30, g: 120, b: 90 } } }).png().toBuffer();
  return new File([new Uint8Array(buf)], name, { type: "image/png" });
}

/** Create, illustrate and publish a listing owned by `owner`. */
export async function publishedListing(owner: Actor, moderator: Actor, overrides: Record<string, unknown> = {}) {
  const { createProperty, addImages, ownerListingAction, moderateListing } = await import("@/server/services/properties");
  const p = await createProperty(owner, await houseInput(overrides));
  await addImages(owner, p.id, [await pngFile()]);
  await ownerListingAction(owner, p.id, "submit");
  await moderateListing(moderator, p.id, { action: "approve" });
  return db.property.findUniqueOrThrow({ where: { id: p.id } });
}
