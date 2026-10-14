import "server-only";
import type { NextResponse } from "next/server";
import { json } from "@/server/http";
import { SESSION_COOKIE, sessionCookieOptions, resolveSession } from "@/server/auth/session";
import { getMe } from "@/server/services/users";

/** Web clients get an HttpOnly cookie; the mobile app (X-Client: mobile) gets a bearer token in the body. */
export async function authResponse(token: string, expiresAt: Date, mobile: boolean): Promise<NextResponse> {
  const actor = await resolveSession(token);
  const user = await getMe(actor);
  const res = json({ user, expiresAt: expiresAt.toISOString(), ...(mobile ? { token } : {}) });
  if (!mobile) res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
}
