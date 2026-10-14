import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as favorites } from "@/app/api/v1/favorites/route";
import { GET as health } from "@/app/api/health/route";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { login, register } from "@/server/services/auth";

async function session() {
  const email = `http-${Date.now()}@test.sukkot.sl`;
  await register({ fullName: "Http Test", email, password: "Freetown2026", acceptTerms: true }, { client: "web" });
  return (await login({ email, password: "Freetown2026" }, { client: "web" })).token;
}

describe("route handlers", () => {
  it("blocks cross-site cookie requests but accepts same-origin and bearer requests", async () => {
    const token = await session();
    const body = JSON.stringify({ propertyId: "does-not-exist", save: true });
    const ctx = { params: Promise.resolve({}) };

    const cross = await favorites(new NextRequest("http://localhost:3000/api/v1/favorites", { method: "POST", body, headers: { cookie: `ss_session=${token}`, origin: "https://evil.example", host: "localhost:3000", "content-type": "application/json" } }), ctx);
    expect(cross.status).toBe(403);

    const same = await favorites(new NextRequest("http://localhost:3000/api/v1/favorites", { method: "POST", body, headers: { cookie: `ss_session=${token}`, origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" } }), ctx);
    expect(same.status).toBe(404);

    const bearer = await favorites(new NextRequest("http://localhost:3000/api/v1/favorites", { method: "POST", body, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } }), ctx);
    expect(bearer.status).toBe(404);

    const anon = await favorites(new NextRequest("http://localhost:3000/api/v1/favorites", { method: "POST", body, headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" } }), ctx);
    expect(anon.status).toBe(401);
  });

  it("lets the mobile app sign in without an Origin header and never authenticates it by cookie", async () => {
    const email = `mobile-${Date.now()}@test.sukkot.sl`;
    await register({ fullName: "Mobile Test", email, password: "Freetown2026", acceptTerms: true }, { client: "mobile" });
    const ctx = { params: Promise.resolve({}) };
    const headers = { "x-client": "mobile", "content-type": "application/json", "x-forwarded-for": "10.9.8.7" };

    const res = await loginRoute(new NextRequest("http://localhost:3000/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password: "Freetown2026" }), headers }), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.token).toBe("string");
    expect(res.headers.get("set-cookie")).toBeNull();

    // A cookie on a mobile-flagged request is ignored, so it cannot be used to skip the origin check.
    const cookieOnly = await favorites(
      new NextRequest("http://localhost:3000/api/v1/favorites", { method: "POST", body: JSON.stringify({ propertyId: "x", save: true }), headers: { ...headers, cookie: `ss_session=${json.token}` } }),
      ctx,
    );
    expect(cookieOnly.status).toBe(401);
  });

  it("reports health with a live database check", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });
});
