import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
