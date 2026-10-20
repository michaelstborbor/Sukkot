import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { issueEmailVerification, register, resendEmailVerification, verifyEmail } from "@/server/services/auth";
import { createProperty, addImages, ownerListingAction } from "@/server/services/properties";
import { houseInput, pngFile } from "../support/factory";
import { resolveSession } from "@/server/auth/session";

const tokenOf = (link: string) => new URL(link).searchParams.get("token")!;

async function signUp() {
  const email = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.sukkot.sl`;
  const reg = await register({ fullName: "Fatmata Sesay", email, password: "Freetown2026", accountType: "OWNER", acceptTerms: true }, { client: "web" });
  return { ...reg, email, actor: (await resolveSession(reg.token))! };
}

describe("email verification", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("emails a single-use link at sign-up, and a new link cancels the old one", async () => {
    const { userId, email } = await signUp();
    expect(await db.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ emailVerifiedAt: null });
    expect(await db.authToken.count({ where: { userId, type: "EMAIL_VERIFICATION", usedAt: null } })).toBe(1);

    const first = await issueEmailVerification(userId, email);
    const second = await issueEmailVerification(userId, email);
    await expect(verifyEmail(tokenOf(first))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await verifyEmail(tokenOf(second));
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).emailVerifiedAt).not.toBeNull();
    // Used once only.
    await expect(verifyEmail(tokenOf(second))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await resendEmailVerification(userId)).toMatchObject({ alreadyVerified: true });
  });

  it("refuses an expired link", async () => {
    const { userId, email } = await signUp();
    const link = await issueEmailVerification(userId, email);
    await db.authToken.updateMany({ where: { userId, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyEmail(tokenOf(link))).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks submitting a listing until the email is confirmed, when verification is required", async () => {
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "true");
    const { userId, email, actor } = await signUp();
    const p = await createProperty(actor, await houseInput());
    await addImages(actor, p.id, [await pngFile()]);
    await expect(ownerListingAction(actor, p.id, "submit")).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("Confirm your email") });

    await verifyEmail(tokenOf(await issueEmailVerification(userId, email)));
    expect((await ownerListingAction(actor, p.id, "submit")).listingStatus).toBe("PENDING_REVIEW");
  });

  it("does not block anyone when the site cannot send email", async () => {
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "false");
    const { actor } = await signUp();
    const p = await createProperty(actor, await houseInput());
    await addImages(actor, p.id, [await pngFile()]);
    expect((await ownerListingAction(actor, p.id, "submit")).listingStatus).toBe("PENDING_REVIEW");
  });
});
