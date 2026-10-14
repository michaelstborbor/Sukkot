import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { login, register } from "@/server/services/auth";
import { resolveSession, destroySession } from "@/server/auth/session";

const meta = { client: "web" as const };

describe("auth", () => {
  it("registers, signs in and resolves a session from the opaque token only", async () => {
    const email = `reg-${Date.now()}@test.sukkot.sl`;
    const reg = await register({ fullName: "Aminata Kamara", email, password: "Freetown2026", accountType: "OWNER", acceptTerms: true }, meta);
    const stored = await db.session.findFirstOrThrow({ where: { userId: reg.userId } });
    expect(stored.tokenHash).not.toBe(reg.token);
    const actor = await resolveSession(reg.token);
    expect(actor?.email).toBe(email);
    expect(actor?.roles).toEqual(expect.arrayContaining(["USER", "OWNER"]));
    const again = await login({ email, password: "Freetown2026" }, meta);
    expect(again.token).not.toBe(reg.token);
    await destroySession(again.token);
    expect(await resolveSession(again.token)).toBeNull();
  });

  it("rejects duplicate emails and cannot self-assign staff roles", async () => {
    const email = `dup-${Date.now()}@test.sukkot.sl`;
    await register({ fullName: "First", email, password: "Freetown2026", acceptTerms: true }, meta);
    await expect(register({ fullName: "Second", email, password: "Freetown2026", acceptTerms: true }, meta)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      register({ fullName: "Sneaky", email: `x${email}`, password: "Freetown2026", acceptTerms: true, accountType: "SUPER_ADMIN" as never }, meta),
    ).rejects.toThrow();
  });

  it("uses one generic error for wrong passwords and locks after repeated failures", async () => {
    const email = `lock-${Date.now()}@test.sukkot.sl`;
    await register({ fullName: "Lock Test", email, password: "Freetown2026", acceptTerms: true }, meta);
    const unknown = await login({ email: `nobody-${email}`, password: "whatever123" }, meta).catch((e) => e);
    const wrong = await login({ email, password: "wrongpass123" }, meta).catch((e) => e);
    expect(wrong.message).toBe(unknown.message);
    for (let i = 0; i < 7; i++) await login({ email, password: "wrongpass123" }, meta).catch(() => undefined);
    await expect(login({ email, password: "Freetown2026" }, meta)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
