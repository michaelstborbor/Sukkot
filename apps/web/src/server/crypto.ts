import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const sha256 = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function hmac(data: string, secret = env.appSecret): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** One-way hash of an IP address so we can rate-limit and audit without storing raw IPs. */
export const hashIp = (ip: string | null | undefined) => (ip ? hmac(`ip:${ip}`).slice(0, 32) : null);

/**
 * Encrypt a secret (such as a payment provider key) before it is stored in the database, with
 * AES-256-GCM under a key derived from APP_SECRET. Changing APP_SECRET makes stored secrets unreadable,
 * so they have to be entered again.
 */
const settingsKey = () => createHash("sha256").update(`settings-encryption:${env.appSecret}`).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", settingsKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(":");
}

/** The secret, or null when it is empty or cannot be read (for example after APP_SECRET changed). */
export function decryptSecret(stored: string): string | null {
  const [v, iv, tag, body] = stored.split(":");
  if (v !== "v1" || !iv || !tag || body === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", settingsKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
