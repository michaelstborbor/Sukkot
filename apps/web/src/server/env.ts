import "server-only";

function read(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable ${name}`);
}

const isProd = process.env.NODE_ENV === "production";

export const env = {
  isProd,
  appUrl: read("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  get appSecret(): string {
    const s = read("APP_SECRET", isProd ? undefined : "insecure-development-secret-change-me");
    if (isProd && s.length < 32) throw new Error("APP_SECRET must be at least 32 characters in production");
    return s;
  },
  storageDriver: read("STORAGE_DRIVER", "local") as "local" | "s3" | "database",
  storageLocalDir: read("STORAGE_LOCAL_DIR", "./storage"),
  storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || "",
  emailDriver: read("EMAIL_DRIVER", "console") as "console" | "resend",
  emailFrom: read("EMAIL_FROM", "Sukkot Salone <no-reply@example.sl>"),
  smsDriver: read("SMS_DRIVER", "console") as "console" | "twilio",
  /**
   * How many proxies in front of the app append to X-Forwarded-For. The client's address is that many
   * entries from the right; anything further left was sent by the client and cannot be trusted.
   */
  trustedProxyHops: Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1),
  /** Demo mode shows sample-data notices. It is forced off in production unless explicitly set. */
  demoMode: (process.env.DEMO_MODE ?? (isProd ? "false" : "true")) === "true",
  paymentMethodsEnabled: read("PAYMENT_METHODS_ENABLED", "SANDBOX,BANK_TRANSFER,CASH,MANUAL")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
