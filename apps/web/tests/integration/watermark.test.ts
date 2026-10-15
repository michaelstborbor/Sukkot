import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { db } from "@/server/db";
import { storage } from "@/server/storage";
import { storeImage } from "@/server/uploads";
import { watermarkExistingPhotos } from "@/server/watermark-backfill";
import { makeUser, publishedListing } from "../support/factory";

describe("watermarking older photos", () => {
  it("marks new uploads at once, and older unmarked photos once on start-up", async () => {
    const owner = await makeUser(["OWNER"]);
    const listing = await publishedListing(owner, await makeUser(["MODERATOR"]));
    const [uploaded] = await db.propertyImage.findMany({ where: { propertyId: listing.id } });
    expect(uploaded!.watermarked).toBe(true);

    // A photo stored the old way, before marking existed.
    const grey = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 60, g: 60, b: 60 } } }).jpeg().toBuffer();
    const stored = await storeImage(new File([new Uint8Array(grey)], "old.jpg", { type: "image/jpeg" }), `properties/${listing.id}`);
    const old = await db.propertyImage.create({ data: { propertyId: listing.id, storageKey: stored.baseKey, width: stored.width, height: stored.height, sortOrder: 5 } });
    const before = (await storage().get(`${stored.baseKey}-960.webp`, "public"))!.body;

    expect(await watermarkExistingPhotos()).toBeGreaterThanOrEqual(1);
    expect((await db.propertyImage.findUniqueOrThrow({ where: { id: old.id } })).watermarked).toBe(true);
    const after = (await storage().get(`${stored.baseKey}-960.webp`, "public"))!.body;
    expect(after.equals(before)).toBe(false);

    // Running again leaves it alone: the mark is drawn once.
    await watermarkExistingPhotos();
    expect((await storage().get(`${stored.baseKey}-960.webp`, "public"))!.body.equals(after)).toBe(true);
  });
});
