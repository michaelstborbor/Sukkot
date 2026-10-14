import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { AppError, toAppError, unauthenticated } from "./errors";
import { resolveSession, SESSION_COOKIE, type Actor } from "./auth/session";
import { hashIp } from "./crypto";
import { env } from "./env";
import { rateLimit } from "./rate-limit";

/** JSON serialisation that turns BigInt money into strings and Dates into ISO strings. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

export function json(data: unknown, init: ResponseInit = {}): NextResponse {
  return new NextResponse(toJson(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init.headers },
  });
}

export function errorResponse(err: unknown): NextResponse {
  const e = toAppError(err);
  return json({ error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } }, { status: e.status });
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF protection for cookie-authenticated requests: the Origin (or Referer) must match our host.
 * Bearer-token requests (mobile app) are not cookie-bound and are exempt.
 */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) throw new AppError("FORBIDDEN", "Missing request origin");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Invalid request origin");
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const allowed = new Set([host, new URL(env.appUrl).host].filter(Boolean));
  if (!allowed.has(originHost)) throw new AppError("FORBIDDEN", "Cross-site request blocked");
}

export interface RouteContext<P> {
  req: NextRequest;
  params: P;
  actor: Actor | null;
  /** True when authenticated with a bearer token (mobile client). */
  viaBearer: boolean;
  ip: string | null;
  ipHash: string | null;
  body<T>(schema: ZodType<T, ZodTypeDef, unknown>): Promise<T>;
  query<T>(schema: ZodType<T, ZodTypeDef, unknown>): T;
  requireActor(): Actor;
  /** Rate-limit by user (or IP when anonymous); `scope` narrows the bucket further, e.g. to an email. */
  limit(bucket: string, l: { limit: number; window: number }, scope?: string): Promise<void>;
}

export async function resolveRequestActor(req: Request): Promise<{ actor: Actor | null; viaBearer: boolean }> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return { actor: await resolveSession(auth.slice(7).trim()), viaBearer: true };
  }
  const cookie = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return { actor: await resolveSession(cookie ? decodeURIComponent(cookie) : null), viaBearer: false };
}

type Handler<P> = (ctx: RouteContext<P>) => Promise<unknown>;

/** Wrap a route handler with auth resolution, CSRF checks, validation helpers and error mapping. */
export function handler<P = Record<string, string>>(fn: Handler<P>, opts: { csrf?: boolean } = {}) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const { actor, viaBearer } = await resolveRequestActor(req);
      if (MUTATING.has(req.method) && !viaBearer && opts.csrf !== false) assertSameOrigin(req);
      const ip = clientIp(req);
      const ctx: RouteContext<P> = {
        req,
        params: (await context?.params) ?? ({} as P),
        actor,
        viaBearer,
        ip,
        ipHash: hashIp(ip),
        async body(schema) {
          let raw: unknown;
          try {
            raw = await req.json();
          } catch {
            throw new AppError("BAD_REQUEST", "Request body must be valid JSON");
          }
          return schema.parse(raw);
        },
        query(schema) {
          return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
        },
        requireActor() {
          if (!actor) throw unauthenticated();
          return actor;
        },
        async limit(bucket, l, scope) {
          await rateLimit(`${bucket}:${actor?.id ?? ctx.ipHash ?? "anon"}${scope ? `:${scope}` : ""}`, l.limit, l.window);
        },
      };
      const result = await fn(ctx);
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
