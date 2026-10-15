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

/** How far apart two stored variants are, per pixel on average, within a region. */
async function regionDiff(a: Buffer, b: Buffer, left: number, top: number, width: number, height: number) {
  const px = (buf: Buffer) => sharp(buf).extract({ left, top, width, height }).removeAlpha().raw().toBuffer();
  const [x, y] = await Promise.all([px(a), px(b)]);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i]! - y[i]!);
  return sum / x.length;
}

describe("listing photo watermark", () => {
  it("draws the Sukkot Salone mark into the bottom-right of every size, and nowhere else", async () => {
    const grey = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 60, g: 60, b: 60 } } }).jpeg().toBuffer();
    const file = () => new File([new Uint8Array(grey)], "plain.jpg", { type: "image/jpeg" });
    const plain = await storeImage(file(), "test-uploads");
    const marked = await storeImage(file(), "test-uploads", { watermark: true });
    expect(plain.watermarked).toBe(false);
    expect(marked.watermarked).toBe(true);

    for (const w of [480, 960, 1600]) {
      const h = Math.round((w * 3) / 4);
      const a = (await storage().get(`${plain.baseKey}-${w}.webp`, "public"))!.body;
      const b = (await storage().get(`${marked.baseKey}-${w}.webp`, "public"))!.body;
      expect((await sharp(b).metadata()).width).toBe(w);
      // The mark sits in the bottom-right corner…
      expect(await regionDiff(a, b, Math.round(w * 0.7), Math.round(h * 0.88), Math.round(w * 0.27), Math.round(h * 0.08))).toBeGreaterThan(10);
      // …and the rest of the photo is left as it was.
      expect(await regionDiff(a, b, 0, 0, Math.round(w * 0.6), Math.round(h * 0.6))).toBeLessThan(1);
    }
  });
});
