import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import { assertPermission } from "@/server/auth/actor";
import { audit } from "@/server/audit";
import { LIMITS } from "@/server/rate-limit";
import { refreshPublicPages } from "@/server/refresh-pages";
import { getSetting, setSetting } from "@/server/services/settings";
import { storage } from "@/server/storage";
import { storeHeroImage } from "@/server/uploads";

async function deleteFiles(hero: { baseKey: string; widths: number[] } | null) {
  if (!hero) return;
  await Promise.all(hero.widths.map((w) => storage().delete(`${hero.baseKey}-${w}.webp`, "public").catch(() => undefined)));
}

/** Upload a new homepage background photo, replacing the old one. */
export const POST = handler(async (ctx) => {
  const actor = assertPermission(ctx.actor, "admin:settings.manage");
  await ctx.limit("upload", LIMITS.upload);
  const form = await ctx.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a photo");
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
  const stored = await storeHeroImage(file, "site/hero");
  const previous = await getSetting("site.heroImage");
  await setSetting("site.heroImage", { ...stored, alt });
  await deleteFiles(previous);
  await audit({ actorId: actor.id, action: "settings.hero_image", metadata: { width: stored.width, height: stored.height }, ipHash: ctx.ipHash });
  refreshPublicPages();
  return { ok: true, width: stored.width, height: stored.height };
});

/** Go back to the bundled default photo. */
export const DELETE = handler(async (ctx) => {
  const actor = assertPermission(ctx.actor, "admin:settings.manage");
  const previous = await getSetting("site.heroImage");
  await setSetting("site.heroImage", null);
  await deleteFiles(previous);
  await audit({ actorId: actor.id, action: "settings.hero_image_removed", ipHash: ctx.ipHash });
  refreshPublicPages();
  return { ok: true };
});
