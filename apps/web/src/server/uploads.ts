import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "./errors";
import { sha256 } from "./crypto";
import { IMAGE_WIDTHS, storage } from "./storage";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

type Sniffed = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null;

/** Identify a file by its magic bytes; the client-declared type and extension are ignored. */
export function sniffMime(buf: Buffer): Sniffed {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

/** The Sukkot Salone mark, white with a soft shadow so it reads on light and dark photos. */
let watermarkPng: Buffer | null = null;
function watermarkSource() {
  watermarkPng ??= readFileSync(path.join(process.cwd(), "src/server/assets/watermark.png"));
  return watermarkPng;
}

/**
 * The mark sized for a photo `width` x `height` px, and where it goes: bottom right, about a quarter
 * of the photo's width, inset a little from the edges.
 */
export async function watermarkFor(width: number, height: number) {
  const markWidth = Math.max(96, Math.round(width * 0.26));
  const mark = await sharp(watermarkSource()).resize({ width: Math.min(markWidth, width - 8) }).png().toBuffer();
  const meta = await sharp(mark).metadata();
  const inset = Math.round(width * 0.025);
  return { input: mark, left: Math.max(0, width - meta.width! - inset), top: Math.max(0, height - meta.height! - inset) };
}

async function readFile(file: File, max: number): Promise<Buffer> {
  if (file.size > max) throw new AppError("VALIDATION", `File is too large (max ${Math.round(max / 1024 / 1024)} MB)`);
  return Buffer.from(await file.arrayBuffer());
}

/**
 * Store an uploaded image: re-encode to WebP at several widths (strips EXIF/GPS metadata and any
 * embedded payload), and return the base key plus a tiny blurred preview to show while it loads.
 * Photos are decoded once and the widths encoded in parallel; quality 80 with sharp YUV is visually
 * lossless for photos at a fraction of a phone camera JPEG's size.
 */
export async function storeImage(file: File, prefix: string, opts: { watermark?: boolean } = {}) {
  const buf = await readFile(file, MAX_IMAGE_BYTES);
  const mime = sniffMime(buf);
  if (!mime || mime === "application/pdf") throw new AppError("VALIDATION", "Upload a JPEG, PNG or WebP image");
  const img = sharp(buf, { failOn: "error" }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height || meta.width < 400) throw new AppError("VALIDATION", "Images must be at least 400px wide");
  const baseKey = `${prefix}/${randomUUID()}`;
  // Width/height as displayed (after EXIF rotation), so the page reserves the right space.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  await Promise.all(
    IMAGE_WIDTHS.map(async (w) => {
      const outW = Math.min(w, width);
      const outH = Math.round((height * outW) / width);
      let pipeline = img.clone().resize({ width: outW });
      if (opts.watermark) pipeline = pipeline.composite([await watermarkFor(outW, outH)]);
      const out = await pipeline.webp({ quality: 80, smartSubsample: true, effort: 4 }).toBuffer();
      await storage().put(`${baseKey}-${w}.webp`, out, "image/webp", "public");
    }),
  );
  const tiny = await img.clone().resize({ width: 24 }).blur(1).webp({ quality: 40 }).toBuffer();
  return {
    baseKey,
    width,
    height,
    watermarked: !!opts.watermark,
    placeholder: `data:image/webp;base64,${tiny.toString("base64")}`,
  };
}

/** Widths of the homepage background photo: phones, tablets, laptops, large and high-density screens. */
export const HERO_WIDTHS = [768, 1280, 1920, 2560] as const;

/**
 * Store a wide background photo for the homepage hero as WebP at each of HERO_WIDTHS (never enlarged),
 * with location and camera data removed. Quality is a little lower than listing photos because the
 * photo sits under a dark overlay and text.
 */
export async function storeHeroImage(file: File, prefix: string) {
  const buf = await readFile(file, MAX_IMAGE_BYTES);
  const mime = sniffMime(buf);
  if (!mime || mime === "application/pdf") throw new AppError("VALIDATION", "Upload a JPEG, PNG or WebP image");
  const img = sharp(buf, { failOn: "error" }).rotate();
  const meta = await img.metadata();
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;
  if (width < 1280) throw new AppError("VALIDATION", "Use a photo at least 1280 pixels wide, so it stays sharp on large screens");
  if (width < height) throw new AppError("VALIDATION", "Use a landscape (wide) photo");
  const baseKey = `${prefix}/${randomUUID()}`;
  const widths = HERO_WIDTHS.filter((w) => w <= width);
  if (widths[widths.length - 1] !== width && width < HERO_WIDTHS[HERO_WIDTHS.length - 1]) widths.push(width as (typeof HERO_WIDTHS)[number]);
  await Promise.all(
    widths.map(async (w) => {
      const out = await img.clone().resize({ width: w }).webp({ quality: 72, smartSubsample: true, effort: 5 }).toBuffer();
      await storage().put(`${baseKey}-${w}.webp`, out, "image/webp", "public");
    }),
  );
  const tiny = await img.clone().resize({ width: 32 }).blur(1).webp({ quality: 40 }).toBuffer();
  return { baseKey, width, height, widths: [...widths], placeholder: `data:image/webp;base64,${tiny.toString("base64")}` };
}

/** Store a private document (ID, title deed, survey plan). Never publicly addressable. */
export async function storePrivateDocument(file: File, prefix: string) {
  const buf = await readFile(file, MAX_DOCUMENT_BYTES);
  const mime = sniffMime(buf);
  if (!mime) throw new AppError("VALIDATION", "Upload a PDF, JPEG, PNG or WebP file");
  const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1];
  const key = `${prefix}/${randomUUID()}.${ext}`;
  // Hook point for malware scanning (e.g. ClamAV or a cloud scanning API) before storing.
  await storage().put(key, buf, mime, "private");
  return { key, mimeType: mime, sizeBytes: buf.length, sha256: sha256(buf) };
}
