import "server-only";
import { randomInt } from "node:crypto";
import { formatSlPhone, forgotPasswordSchema, loginSchema, phoneSchema, registerSchema, resetPasswordSchema, type Role } from "@sukkot/shared";
import type { z } from "zod";
import { db } from "../db";
import { AppError } from "../errors";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroyAllSessions } from "../auth/session";
import { randomToken, sha256 } from "../crypto";
import { audit } from "../audit";
import { sendEmail } from "../email";
import { sendSms } from "../sms";
import { env } from "../env";

const LOCK_AFTER = 8;
const LOCK_MINUTES = 15;
const GENERIC_LOGIN_ERROR = "The email or password is incorrect";

export async function register(
  input: z.input<typeof registerSchema>,
  meta: { client: "web" | "mobile"; userAgent?: string | null; ipHash?: string | null },
) {
  const data = registerSchema.parse(input);
  const existing = await db.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) throw new AppError("CONFLICT", "An account with this email already exists. Try signing in.");
  if (data.verifyBy === "PHONE" && data.phone) await assertPhoneFree(data.phone);
  const roles: Role[] = data.accountType === "USER" ? ["USER"] : ["USER", data.accountType];
  const user = await db.user.create({
    data: {
      email: data.email,
      phone: data.phone ?? null,
      passwordHash: await hashPassword(data.password),
      profile: { create: { fullName: data.fullName } },
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
  await audit({ actorId: user.id, action: "auth.register", targetType: "User", targetId: user.id, ipHash: meta.ipHash });
  if (data.verifyBy === "PHONE") await sendPhoneCode(user.id);
  else await issueEmailVerification(user.id, user.email, data.fullName);
  const session = await createSession(user.id, meta);
  return { userId: user.id, ...session };
}

export async function login(
  input: z.input<typeof loginSchema>,
  meta: { client: "web" | "mobile"; userAgent?: string | null; ipHash?: string | null },
) {
  const { email, password } = loginSchema.parse(input);
  const user = await db.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("RATE_LIMITED", "Too many failed attempts. Try again in a few minutes or reset your password.");
  }
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) {
    if (user) {
      // Increment in the database so parallel guesses cannot all read the same count.
      const { failedLoginCount } = await db.user.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true } });
      if (failedLoginCount >= LOCK_AFTER) {
        await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } });
      }
    }
    throw new AppError("UNAUTHENTICATED", GENERIC_LOGIN_ERROR);
  }
  if (user.status !== "ACTIVE") throw new AppError("FORBIDDEN", "This account is not active. Contact support for help.");
  // Seeded demo accounts share a published password, so they can only sign in when demo mode is on
  // (never by default in production).
  if (user.isDemo && !env.demoMode) throw new AppError("FORBIDDEN", "Demo accounts are disabled on this site.");
  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: "auth.login", targetType: "User", targetId: user.id, ipHash: meta.ipHash });
  const session = await createSession(user.id, meta);
  return { userId: user.id, ...session };
}

async function issueToken(userId: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET", ttlMinutes: number) {
  const token = randomToken(32);
  await db.authToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
  });
  return token;
}

/*
 * Email or phone verification
 *
 * 1. Sign-up creates the account, signs the person in and, depending on what they chose, emails a
 *    single-use link (valid 3 days) or texts a 6-digit code to their phone (valid 10 minutes).
 * 2. They can browse, save, enquire and message straight away. Until the address is confirmed the
 *    dashboard shows a banner with a "Send the link again" button (3 an hour); each new link
 *    cancels the earlier ones.
 * 3. Opening the link confirms the address; entering the code confirms the phone number. Only
 *    hashes are stored, and a code is bound to the number it was sent to. Either one is enough.
 * 4. Submitting a listing for review, asking for a photo shoot, making an offer, applying to rent
 *    and paying Sukkot Salone need a confirmed email or phone (see `requireVerifiedContact`). This is
 *    enforced whenever the site can actually send email or texts, or when REQUIRE_EMAIL_VERIFICATION=true.
 */

const VERIFY_TTL_MINUTES = 60 * 24 * 3;

const PHONE_CODE_TTL_MINUTES = 10;

/** Whether actions that need a confirmed email or phone are blocked for unconfirmed accounts. */
export function emailVerificationRequired() {
  const flag = process.env.REQUIRE_EMAIL_VERIFICATION;
  if (flag === "true" || flag === "false") return flag === "true";
  // Without a real email or text service nobody could confirm, so the requirement would lock everyone out.
  return env.emailDriver !== "console" || env.smsDriver !== "console";
}

/** Throws a clear error when a signed-in person has confirmed neither their email nor their phone. */
export async function requireVerifiedContact(userId: string, doing: string) {
  if (!emailVerificationRequired()) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, phoneVerifiedAt: true } });
  if (user && !user.emailVerifiedAt && !user.phoneVerifiedAt) {
    throw new AppError("FORBIDDEN", `Confirm your email address or phone number before you ${doing}. You can do either from your dashboard.`);
  }
}

/** A number already confirmed on another account cannot confirm this one too. */
async function assertPhoneFree(phone: string, userId?: string) {
  const taken = await db.user.findFirst({ where: { phone, phoneVerifiedAt: { not: null }, ...(userId ? { id: { not: userId } } : {}) }, select: { id: true } });
  if (taken) throw new AppError("CONFLICT", "This phone number is already confirmed on another account. Use a different number or confirm your email instead.", { phone: "Already in use" });
}

const phoneCodeHash = (userId: string, phone: string, code: string) => sha256(`phone:${userId}:${phone}:${code}`);

/**
 * Text a 6-digit code to the person's phone, cancelling any earlier code. A new number replaces the
 * one on the account (and its confirmation). Returns the code itself only on a demo site without a
 * text service, so the flow can be tried.
 */
export async function sendPhoneCode(userId: string, newPhone?: unknown) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
  if (!user) throw new AppError("NOT_FOUND", "Account not found");
  const phone = newPhone === undefined || newPhone === "" ? user.phone : phoneSchema.parse(newPhone);
  if (!phone) throw new AppError("VALIDATION", "Enter your phone number", { phone: "Required" });
  if (user.phoneVerifiedAt && phone === user.phone) return { alreadyVerified: true as const, phone, demoCode: null };
  await assertPhoneFree(phone, userId);
  if (phone !== user.phone) await db.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: null } });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, type: "PHONE_VERIFICATION" } }),
    db.authToken.create({ data: { userId, type: "PHONE_VERIFICATION", tokenHash: phoneCodeHash(userId, phone, code), expiresAt: new Date(Date.now() + PHONE_CODE_TTL_MINUTES * 60_000) } }),
  ]);
  const sent = await sendSms({ to: phone, text: `${code} is your Sukkot Salone code. It expires in ${PHONE_CODE_TTL_MINUTES} minutes. Never share it with anyone.` });
  if (!sent) throw new AppError("INTERNAL", "We could not send a text just now. Try again later, or confirm your email instead.");
  await audit({ actorId: userId, action: "auth.phone_code_sent", targetType: "User", targetId: userId });
  return { alreadyVerified: false as const, phone: formatSlPhone(phone), demoCode: env.demoMode && env.smsDriver === "console" ? code : null };
}

/** Check the code texted to the phone on the account and mark the number confirmed. */
export async function verifyPhoneCode(userId: string, input: unknown) {
  const code = typeof (input as { code?: unknown })?.code === "string" ? (input as { code: string }).code.replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) throw new AppError("VALIDATION", "Enter the 6-digit code from the text", { code: "Enter 6 digits" });
  const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user?.phone) throw new AppError("BAD_REQUEST", "Add your phone number first");
  const row = await db.authToken.findUnique({ where: { tokenHash: phoneCodeHash(userId, user.phone, code) } });
  if (!row || row.type !== "PHONE_VERIFICATION" || row.userId !== userId || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError("BAD_REQUEST", "That code is wrong or has expired. Check the text, or send a new code.", { code: "Wrong or expired code" });
  }
  await assertPhoneFree(user.phone, userId);
  const now = new Date();
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: now } }),
    db.user.update({ where: { id: userId }, data: { phoneVerifiedAt: now } }),
  ]);
  await audit({ actorId: userId, action: "auth.phone_verified", targetType: "User", targetId: userId });
  return { phone: formatSlPhone(user.phone) };
}

/** Email a new confirmation link, cancelling any earlier ones. Returns the link so demo sites without email can show it. */
export async function issueEmailVerification(userId: string, email: string, name?: string) {
  await db.authToken.updateMany({ where: { userId, type: "EMAIL_VERIFICATION", usedAt: null }, data: { usedAt: new Date() } });
  const token = await issueToken(userId, "EMAIL_VERIFICATION", VERIFY_TTL_MINUTES);
  const link = `${env.appUrl}/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Confirm your email for Sukkot Salone",
    text: [
      `Hello${name ? ` ${name}` : ""},`,
      "",
      "Welcome to Sukkot Salone. Please confirm this is your email address by opening the link below:",
      link,
      "",
      "The link works once and expires in 3 days. You need a confirmed email to submit a listing, make an offer, apply to rent or pay for a service.",
      "",
      "If you did not create a Sukkot Salone account, ignore this email and the account stays unconfirmed.",
    ].join("\n"),
  });
  return link;
}

/** Send the link again from the dashboard banner or the expired-link page. */
export async function resendEmailVerification(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, profile: { select: { fullName: true } } } });
  if (!user) throw new AppError("NOT_FOUND", "Account not found");
  if (user.emailVerifiedAt) return { alreadyVerified: true as const, email: user.email, demoLink: null };
  const link = await issueEmailVerification(userId, user.email, user.profile?.fullName);
  await audit({ actorId: userId, action: "auth.email_verification_resent", targetType: "User", targetId: userId });
  // A demo site without an email service shows the link on screen instead, so the flow can be tried.
  return { alreadyVerified: false as const, email: user.email, demoLink: env.demoMode && env.emailDriver === "console" ? link : null };
}

export async function verifyEmail(token: string) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== "EMAIL_VERIFICATION" || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError("BAD_REQUEST", "This link is invalid or has expired");
  }
  const now = new Date();
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: now } }),
    db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: now } }),
  ]);
  await audit({ actorId: row.userId, action: "auth.email_verified", targetType: "User", targetId: row.userId });
  return { userId: row.userId };
}

/** Always succeeds from the caller's point of view, so it cannot be used to discover accounts. */
export async function requestPasswordReset(input: unknown) {
  const { email } = forgotPasswordSchema.parse(input);
  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, status: true } });
  if (!user || user.status !== "ACTIVE") return;
  // Only the newest link works.
  await db.authToken.updateMany({ where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } });
  const token = await issueToken(user.id, "PASSWORD_RESET", 60);
  await sendEmail({
    to: user.email,
    subject: "Reset your Sukkot Salone password",
    text: `Someone asked to reset the password for this account. If it was you, open:\n${env.appUrl}/auth/reset-password?token=${token}\n\nThe link expires in 1 hour. If you did not ask for this, ignore this email.`,
  });
  await audit({ actorId: user.id, action: "auth.password_reset_requested", targetType: "User", targetId: user.id });
}

export async function resetPassword(input: unknown) {
  const { token, password } = resetPasswordSchema.parse(input);
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== "PASSWORD_RESET" || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError("BAD_REQUEST", "This reset link is invalid or has expired");
  }
  await db.$transaction([
    db.authToken.updateMany({ where: { userId: row.userId, type: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } }),
    db.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null },
    }),
  ]);
  await destroyAllSessions(row.userId);
  await audit({ actorId: row.userId, action: "auth.password_reset", targetType: "User", targetId: row.userId });
}
