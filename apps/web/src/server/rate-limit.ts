import "server-only";
import { db } from "./db";
import { AppError } from "./errors";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across serverless instances.
 * One atomic upsert per check.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_buckets ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rate_limit_buckets."resetAt" < now() THEN 1 ELSE rate_limit_buckets."count" + 1 END,
      "resetAt" = CASE WHEN rate_limit_buckets."resetAt" < now()
                       THEN now() + make_interval(secs => ${windowSeconds})
                       ELSE rate_limit_buckets."resetAt" END
    RETURNING "count"`;
  const count = rows[0]?.count ?? 0;
  if (count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.");
  }
}

export const LIMITS = {
  login: { limit: 10, window: 15 * 60 },
  /** Per-IP ceiling across all accounts (shared networks and NAT are common, so it is generous). */
  loginIp: { limit: 60, window: 15 * 60 },
  register: { limit: 5, window: 60 * 60 },
  passwordReset: { limit: 5, window: 60 * 60 },
  enquiry: { limit: 20, window: 60 * 60 },
  message: { limit: 60, window: 10 * 60 },
  report: { limit: 10, window: 60 * 60 },
  upload: { limit: 60, window: 60 * 60 },
  offer: { limit: 20, window: 60 * 60 },
  webhook: { limit: 600, window: 60 },
  /** Transfers waiting for finance; each one notifies staff. */
  manualPayment: { limit: 10, window: 60 * 60 },
} as const;
