import "server-only";
import { randomUUID } from "node:crypto";
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

async function readFile(file: File, max: number): Promise<Buffer> {
  if (file.size > max) throw new AppError("VALIDATION", `File is too large (max ${Math.round(max / 1024 / 1024)} MB)`);
  return Buffer.from(await file.arrayBuffer());
}

/**
 * Store an uploaded image: re-encode to WebP at several widths (strips EXIF/GPS metadata and any
 * embedded payload), and return the base key.
 */
export async function storeImage(file: File, prefix: string) {
  const buf = await readFile(file, MAX_IMAGE_BYTES);
  const mime = sniffMime(buf);
  if (!mime || mime === "application/pdf") throw new AppError("VALIDATION", "Upload a JPEG, PNG or WebP image");
  const img = sharp(buf, { failOn: "error" }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height || meta.width < 400) throw new AppError("VALIDATION", "Images must be at least 400px wide");
  const baseKey = `${prefix}/${randomUUID()}`;
  for (const w of IMAGE_WIDTHS) {
    const out = await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await storage().put(`${baseKey}-${w}.webp`, out, "image/webp", "public");
  }
  return { baseKey, width: meta.width, height: meta.height };
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
