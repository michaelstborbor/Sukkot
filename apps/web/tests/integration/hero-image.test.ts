import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { DELETE as removeHero, POST as uploadHero } from "@/app/api/v1/admin/settings/hero/route";
import { db } from "@/server/db";
import { login, register } from "@/server/services/auth";
import { getSetting, setSetting } from "@/server/services/settings";
import { storage } from "@/server/storage";

async function adminToken() {
  const email = `hero-${Date.now()}@test.sukkot.sl`;
  await register({ fullName: "Hero Admin", email, password: "Freetown2026", acceptTerms: true }, { client: "web" });
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.userRoleAssignment.create({ data: { userId: user.id, role: "SUPER_ADMIN" } });
  return (await login({ email, password: "Freetown2026" }, { client: "web" })).token;
}

async function photo(width: number, height: number) {
  const buf = await sharp({ create: { width, height, channels: 3, background: { r: 20, g: 90, b: 120 } } }).jpeg().toBuffer();
  return new File([new Uint8Array(buf)], "hero.jpg", { type: "image/jpeg" });
}

const ctx = { params: Promise.resolve({}) };
function post(token: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  form.append("alt", "Freetown from the hills");
  return uploadHero(new NextRequest("http://localhost:3000/api/v1/admin/settings/hero", { method: "POST", body: form, headers: { authorization: `Bearer ${token}` } }), ctx);
}

describe("homepage background photo", () => {
  afterEach(async () => setSetting("site.heroImage", null));

  it("stores a wide photo at each screen width, replaces it cleanly and can be removed", async () => {
    const token = await adminToken();
    expect((await post(token, await photo(3000, 1400))).status).toBe(200);
    const first = (await getSetting("site.heroImage"))!;
    expect(first.widths).toEqual([768, 1280, 1920, 2560]);
    expect(first.alt).toBe("Freetown from the hills");
    const big = await storage().get(`${first.baseKey}-2560.webp`, "public");
    expect((await sharp(big!.body).metadata()).width).toBe(2560);

    // A 1600-px photo is kept at its own width and never enlarged; the old files are deleted.
    expect((await post(token, await photo(1600, 900))).status).toBe(200);
    const second = (await getSetting("site.heroImage"))!;
    expect(second.widths).toEqual([768, 1280, 1600]);
    expect(await storage().get(`${first.baseKey}-2560.webp`, "public")).toBeNull();

    const res = await removeHero(new NextRequest("http://localhost:3000/api/v1/admin/settings/hero", { method: "DELETE", headers: { authorization: `Bearer ${token}` } }), ctx);
    expect(res.status).toBe(200);
    expect(await getSetting("site.heroImage")).toBeNull();
    expect(await storage().get(`${second.baseKey}-1600.webp`, "public")).toBeNull();
  });

  it("refuses photos that are too small or not landscape", async () => {
    const token = await adminToken();
    expect((await post(token, await photo(1000, 600))).status).toBe(422);
    expect((await post(token, await photo(1400, 2000))).status).toBe(422);
    expect(await getSetting("site.heroImage")).toBeNull();
  });
});
