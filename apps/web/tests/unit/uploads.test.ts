import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { storeImage } from "@/server/uploads";
import { storage } from "@/server/storage";

/** A noisy photo-like JPEG, as a phone would send it: stored sideways with an EXIF rotation flag. */
async function phonePhoto() {
  const width = 2400;
  const height = 1800;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 251;
  const buf = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).withMetadata({ orientation: 6 }).toBuffer();
  return { file: new File([new Uint8Array(buf)], "IMG_0001.jpg", { type: "image/jpeg" }), bytes: buf.length };
}

describe("photo uploads", () => {
  it("stores three WebP sizes, upright, smaller than the original, with a tiny preview", async () => {
    const { file, bytes } = await phonePhoto();
    const stored = await storeImage(file, "test-uploads");
    // Orientation 6 means the camera held it sideways: shown portrait.
    expect([stored.width, stored.height]).toEqual([1800, 2400]);
    expect(stored.placeholder).toMatch(/^data:image\/webp;base64,/);
    expect(stored.placeholder.length).toBeLessThan(1500);

    for (const w of [480, 960, 1600]) {
      const f = await storage().get(`${stored.baseKey}-${w}.webp`, "public");
      const meta = await sharp(f!.body).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(w);
      expect(meta.orientation ?? 1).toBe(1);
      expect(meta.exif).toBeUndefined();
      expect(f!.body.length).toBeLessThan(bytes);
    }
  });
});
