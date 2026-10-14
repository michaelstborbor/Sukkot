import "server-only";
import type { Role } from "@sukkot/shared";
import { db } from "../db";
import { randomToken, sha256 } from "../crypto";
import { env } from "../env";

export const SESSION_COOKIE = env.isProd ? "__Host-ss_session" : "ss_session";
const WEB_TTL_DAYS = 30;
const MOBILE_TTL_DAYS = 90;
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

export interface Actor {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  sessionId: string;
  isDemo: boolean;
}

export async function createSession(
  userId: string,
  opts: { client: "web" | "mobile"; userAgent?: string | null; ipHash?: string | null },
) {
  const token = randomToken(32);
  const ttl = (opts.client === "mobile" ? MOBILE_TTL_DAYS : WEB_TTL_DAYS) * 86400_000;
  const expiresAt = new Date(Date.now() + ttl);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      client: opts.client,
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
      ipHash: opts.ipHash ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

/** Resolve a raw session token to an actor. Expired sessions and suspended users resolve to null. */
export async function resolveSession(token: string | null | undefined): Promise<Actor | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { roles: true, profile: { select: { fullName: true } } } } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || session.user.status !== "ACTIVE") {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  const roles = session.user.roles.map((r) => r.role as Role);
  if (!roles.includes("USER")) roles.unshift("USER");
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.profile?.fullName ?? session.user.email,
    roles,
    sessionId: session.id,
    isDemo: session.user.isDemo,
  };
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function destroyAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
