import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { DatabaseDriver, storage } from "@/server/storage";
import { restoreDemoArtwork } from "@/server/demo-art-restore";
import { makeUser, publishedListing } from "../support/factory";

describe("database file storage", () => {
  it("keeps, replaces and deletes files, with public and private kept apart", async () => {
    const store = new DatabaseDriver();
    const key = `test/${Date.now()}/photo-960.webp`;
    await store.put(key, Buffer.from("first"), "image/webp", "public");
    expect((await store.get(key, "public"))!.body.toString()).toBe("first");
    expect(await store.get(key, "private")).toBeNull();

    await store.put(key, Buffer.from("second"), "image/webp", "public");
    const got = await store.get(key, "public");
    expect(got!.body.toString()).toBe("second");
    expect(got!.contentType).toBe("image/webp");

    await store.delete(key, "public");
    expect(await store.get(key, "public")).toBeNull();
    await expect(store.put("../escape", Buffer.from("x"), "text/plain", "public")).rejects.toThrow();
  });
});

describe("lost demo artwork", () => {
  it("is drawn again, and existing files are left alone", async () => {
    const listing = await publishedListing(await makeUser(["OWNER"]), await makeUser(["MODERATOR"]));
    const key = `demo/test-${listing.id}-1.svg`;
    await db.propertyImage.create({ data: { propertyId: listing.id, storageKey: key, width: 1600, height: 1200, sortOrder: 9, illustrative: true, alt: "Illustrative" } });
    expect(await storage().get(key, "public")).toBeNull();

    expect(await restoreDemoArtwork()).toBeGreaterThanOrEqual(1);
    const drawn = await storage().get(key, "public");
    expect(drawn!.body.toString()).toContain("Illustrative image");
    await restoreDemoArtwork();
    expect((await storage().get(key, "public"))!.body.equals(drawn!.body)).toBe(true);
  });
});
