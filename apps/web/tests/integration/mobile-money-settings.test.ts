import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as saveSettings } from "@/app/api/v1/admin/settings/route";
import { db } from "@/server/db";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { availableOnlineMethods } from "@/server/payments";
import { clearMobileMoneyConfig } from "@/server/payments/config";
import { login, register } from "@/server/services/auth";
import { getSetting, SETTING_DEFAULTS, setSetting } from "@/server/services/settings";

async function adminToken() {
  const email = `settings-${Date.now()}@test.sukkot.sl`;
  await register({ fullName: "Settings Admin", email, password: "Freetown2026", acceptTerms: true }, { client: "web" });
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.userRoleAssignment.create({ data: { userId: user.id, role: "SUPER_ADMIN" } });
  return (await login({ email, password: "Freetown2026" }, { client: "web" })).token;
}

const post = (token: string, body: unknown) =>
  saveSettings(new NextRequest("http://localhost:3000/api/v1/admin/settings", { method: "POST", body: JSON.stringify(body), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } }), { params: Promise.resolve({}) });

const orange = { enabled: true, apiBase: "", country: "sl", clientId: "client-123", clientSecret: "top-secret", merchantKey: "merchant-key" };

describe("mobile money in site settings", () => {
  afterEach(async () => {
    await setSetting("payments.mobileMoney", SETTING_DEFAULTS["payments.mobileMoney"]);
    clearMobileMoneyConfig();
  });

  it("encrypts secrets and reads them back only with the right key", () => {
    const stored = encryptSecret("top-secret");
    expect(stored).not.toContain("top-secret");
    expect(decryptSecret(stored)).toBe("top-secret");
    expect(decryptSecret(stored.slice(0, -2) + "xx")).toBeNull();
  });

  it("switches Orange Money on from settings, keeps saved keys, and never logs or returns them", async () => {
    const token = await adminToken();
    expect(await availableOnlineMethods()).not.toContain("ORANGE_MONEY");

    expect((await post(token, { orangeMoney: orange })).status).toBe(200);
    const saved = await getSetting("payments.mobileMoney");
    expect(saved.orangeMoney.clientSecret).not.toContain("top-secret");
    expect(decryptSecret(saved.orangeMoney.clientSecret)).toBe("top-secret");
    expect(await availableOnlineMethods()).toContain("ORANGE_MONEY");

    // Saving again with the secret fields left empty keeps the saved keys.
    expect((await post(token, { orangeMoney: { ...orange, clientSecret: "", merchantKey: "" } })).status).toBe(200);
    expect(decryptSecret((await getSetting("payments.mobileMoney")).orangeMoney.merchantKey)).toBe("merchant-key");

    const logs = await db.auditLog.findMany({ where: { action: "settings.update" }, orderBy: { createdAt: "desc" }, take: 2 });
    expect(JSON.stringify(logs.map((l) => l.metadata))).not.toMatch(/top-secret|merchant-key/);
  });

  it("refuses to switch a method on without all its details, and leaves it off", async () => {
    const token = await adminToken();
    const res = await post(token, { afrimoney: { enabled: true, apiBase: "https://api.example.sl", merchantId: "M-1", apiKey: "", webhookSecret: "" } });
    expect(res.status).toBe(422);
    expect((await res.json()).error.fields).toMatchObject({ "afrimoney.apiKey": "Required", "afrimoney.webhookSecret": "Required" });
    const saved = await getSetting("payments.mobileMoney");
    expect(saved.afrimoney.enabled).toBe(false);
    expect(saved.afrimoney.merchantId).toBe("M-1");
    expect(await availableOnlineMethods()).not.toContain("AFRIMONEY");
  });
});
