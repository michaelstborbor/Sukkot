import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { register, requireVerifiedContact, sendPhoneCode, verifyPhoneCode } from "@/server/services/auth";
import { updateProfile } from "@/server/services/users";
import { resolveSession } from "@/server/auth/session";

/** A Sierra Leone mobile number no other test uses. */
const freshPhone = () => `+23277${String(Math.floor(100_000 + Math.random() * 900_000))}`;

async function signUp(extra: Record<string, unknown> = {}) {
  const email = `phone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.sukkot.sl`;
  const reg = await register({ fullName: "Ibrahim Conteh", email, password: "Freetown2026", accountType: "USER", acceptTerms: true, ...extra }, { client: "web" });
  return { ...reg, email, actor: (await resolveSession(reg.token))! };
}

describe("phone verification", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("texts a code instead of emailing a link when chosen at sign-up, and the code works once", async () => {
    await expect(signUp({ verifyBy: "PHONE" })).rejects.toThrow(/phone number to send the code to/);
    const phone = freshPhone();
    const { userId } = await signUp({ verifyBy: "PHONE", phone });
    expect(await db.authToken.count({ where: { userId, type: "EMAIL_VERIFICATION" } })).toBe(0);
    expect(await db.authToken.count({ where: { userId, type: "PHONE_VERIFICATION", usedAt: null } })).toBe(1);

    // A new code replaces the one sent at sign-up; only the newest works.
    const { demoCode } = await sendPhoneCode(userId);
    expect(demoCode).toMatch(/^\d{6}$/);
    expect(await db.authToken.count({ where: { userId, type: "PHONE_VERIFICATION" } })).toBe(1);
    const wrong = demoCode === "000000" ? "111111" : "000000";
    await expect(verifyPhoneCode(userId, { code: wrong })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(verifyPhoneCode(userId, { code: "12" })).rejects.toMatchObject({ code: "VALIDATION" });

    await verifyPhoneCode(userId, { code: `${demoCode!.slice(0, 3)} ${demoCode!.slice(3)}` });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).phoneVerifiedAt).not.toBeNull();
    await expect(verifyPhoneCode(userId, { code: demoCode })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await sendPhoneCode(userId)).toMatchObject({ alreadyVerified: true });
    expect(await db.auditLog.count({ where: { targetId: userId, action: "auth.phone_verified" } })).toBe(1);
  });

  it("refuses an expired code, and a code sent to a number that has since changed", async () => {
    const { userId, actor } = await signUp();
    const first = await sendPhoneCode(userId, freshPhone());
    await db.authToken.updateMany({ where: { userId, type: "PHONE_VERIFICATION" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyPhoneCode(userId, { code: first.demoCode })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const second = await sendPhoneCode(userId);
    await updateProfile(actor, { phone: freshPhone().replace("+232", "0") });
    await expect(verifyPhoneCode(userId, { code: second.demoCode })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps a confirmed number confirmed when the profile is saved unchanged, and lets one account confirm a number", async () => {
    const phone = freshPhone();
    const a = await signUp({ phone });
    const code = (await sendPhoneCode(a.userId)).demoCode!;
    await verifyPhoneCode(a.userId, { code });
    await updateProfile(a.actor, { phone: `0${phone.slice(4)}`, fullName: "Ibrahim B. Conteh" });
    expect((await db.user.findUniqueOrThrow({ where: { id: a.userId } })).phoneVerifiedAt).not.toBeNull();

    const b = await signUp();
    await expect(sendPhoneCode(b.userId, phone)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(signUp({ verifyBy: "PHONE", phone })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("accepts a confirmed phone in place of a confirmed email", async () => {
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "true");
    const { userId } = await signUp({ phone: freshPhone() });
    await expect(requireVerifiedContact(userId, "make an offer")).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("email address or phone number") });
    await verifyPhoneCode(userId, { code: (await sendPhoneCode(userId)).demoCode });
    await expect(requireVerifiedContact(userId, "make an offer")).resolves.toBeUndefined();
  });
});
