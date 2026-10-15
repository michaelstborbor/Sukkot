/**
 * First-start setup for hosts where you cannot run commands (such as Render's free plan). Runs before
 * the web server starts and never stops it from starting:
 * - an empty database gets the reference data (locations, property types, amenities, plans);
 * - when ADMIN_EMAIL and ADMIN_PASSWORD are set and there is no super administrator yet (demo accounts
 *   aside), that account is created or promoted. Once one exists the variables are ignored, so delete
 *   ADMIN_PASSWORD from the host's settings after the first sign-in.
 * - listing photos uploaded before photos were watermarked get the Sukkot Salone mark.
 * The password is never printed.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { upsertSuperAdmin } from "./lib/super-admin";

async function main() {
  const db = new PrismaClient();
  try {
    if ((await db.location.count()) === 0) {
      console.log("[bootstrap] Empty database: loading reference data.");
      const seed = spawnSync("npx", ["tsx", path.join(__dirname, "../prisma/seed.ts")], { stdio: "inherit", env: { ...process.env, SEED_ALLOW_DEMO: "false" } });
      if (seed.status !== 0) console.error("[bootstrap] Loading reference data failed; see the log above.");
    }

    try {
      const { watermarkExistingPhotos } = await import("../src/server/watermark-backfill");
      const marked = await watermarkExistingPhotos();
      if (marked) console.log(`[bootstrap] Added the Sukkot Salone mark to ${marked} older photo${marked === 1 ? "" : "s"}.`);
    } catch (e) {
      console.error(`[bootstrap] Watermarking older photos skipped: ${e instanceof Error ? e.message : e}`);
    }

    const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name } = process.env;
    if (!email || !password) return;
    const existing = await db.userRoleAssignment.findFirst({ where: { role: "SUPER_ADMIN", user: { isDemo: false, status: "ACTIVE" } }, select: { id: true } });
    if (existing) {
      console.log("[bootstrap] A super administrator already exists, so ADMIN_EMAIL and ADMIN_PASSWORD were ignored. Remove ADMIN_PASSWORD from the host's environment settings.");
      return;
    }
    const ready = await upsertSuperAdmin(db, { email, name: name ?? "Administrator", password, via: "scripts/bootstrap.ts" });
    console.log(`[bootstrap] Super administrator ready: ${ready}. Sign in, then remove ADMIN_PASSWORD from the host's environment settings.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  // Never block the site from starting; the message says what to fix.
  const issues = (e as { issues?: { message: string }[] }).issues;
  const why = issues ? issues.map((i) => i.message).join("; ") : e instanceof Error ? e.message : String(e);
  console.error(`[bootstrap] Skipped: ${why}. Check ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters, letters and numbers).`);
});
