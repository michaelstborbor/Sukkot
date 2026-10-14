import "server-only";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, type Role } from "@sukkot/shared";
import type { z } from "zod";
import { db } from "../db";
import { AppError } from "../errors";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroyAllSessions } from "../auth/session";
import { randomToken, sha256 } from "../crypto";
import { audit } from "../audit";
import { sendEmail } from "../email";
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
  await issueEmailVerification(user.id, user.email);
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
      const failed = user.failedLoginCount + 1;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed >= LOCK_AFTER ? 0 : failed,
          lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
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

export async function issueEmailVerification(userId: string, email: string) {
  const token = await issueToken(userId, "EMAIL_VERIFICATION", 60 * 24 * 3);
  await sendEmail({
    to: email,
    subject: "Confirm your Sukkot Salone email",
    text: `Confirm your email address by opening this link:\n${env.appUrl}/auth/verify-email?token=${token}\n\nThe link expires in 3 days.`,
  });
}

export async function verifyEmail(token: string) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== "EMAIL_VERIFICATION" || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError("BAD_REQUEST", "This link is invalid or has expired");
  }
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
}

/** Always succeeds from the caller's point of view, so it cannot be used to discover accounts. */
export async function requestPasswordReset(input: unknown) {
  const { email } = forgotPasswordSchema.parse(input);
  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, status: true } });
  if (!user || user.status !== "ACTIVE") return;
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
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null },
    }),
  ]);
  await destroyAllSessions(row.userId);
  await audit({ actorId: row.userId, action: "auth.password_reset", targetType: "User", targetId: row.userId });
}
