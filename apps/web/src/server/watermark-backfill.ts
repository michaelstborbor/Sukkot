import "server-only";
import sharp from "sharp";
import { db } from "./db";
import { IMAGE_WIDTHS, storage } from "./storage";
import { watermarkFor } from "./uploads";

/**
 * Draw the Sukkot Salone mark onto listing photos uploaded before photos were marked on upload.
 * Safe to run repeatedly: each photo is done once. Illustrative demo artwork and SVGs are left alone
 * (the site lays the mark over those instead).
 */
export async function watermarkExistingPhotos(limit = 300) {
  const rows = await db.propertyImage.findMany({ where: { watermarked: false, illustrative: false, NOT: { storageKey: { endsWith: ".svg" } } }, take: limit, select: { id: true, storageKey: true } });
  let done = 0;
  for (const row of rows) {
    for (const w of IMAGE_WIDTHS) {
      const key = `${row.storageKey}-${w}.webp`;
      const file = await storage().get(key, "public");
      if (!file) continue; // already gone (for example a wiped free-plan disk): nothing to mark
      const meta = await sharp(file.body).metadata();
      const out = await sharp(file.body)
        .composite([await watermarkFor(meta.width!, meta.height!)])
        .webp({ quality: 80, smartSubsample: true, effort: 4 })
        .toBuffer();
      await storage().put(key, out, "image/webp", "public");
    }
    await db.propertyImage.update({ where: { id: row.id }, data: { watermarked: true } });
    done++;
  }
  return done;
}
