import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../env";
import { db } from "../db";
import { hmac, safeEqual } from "../crypto";

export type Visibility = "public" | "private";

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string, visibility: Visibility): Promise<void>;
  get(key: string, visibility: Visibility): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string, visibility: Visibility): Promise<void>;
  /** Short-lived URL for a private object. */
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}

const SAFE_KEY = /^[a-zA-Z0-9/_.-]{1,300}$/;
export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.startsWith("/")) throw new Error("Invalid storage key");
}

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
};

/** Local filesystem driver for development. Private files live outside any public directory. */
class LocalDriver implements StorageDriver {
  private root = path.resolve(process.cwd(), env.storageLocalDir);
  private file(key: string, v: Visibility) {
    assertSafeKey(key);
    return path.join(this.root, v, key);
  }
  async put(key: string, body: Buffer, _ct: string, v: Visibility) {
    const f = this.file(key, v);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, body);
  }
  async get(key: string, v: Visibility) {
    try {
      const body = await fs.readFile(this.file(key, v));
      return { body, contentType: CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  async delete(key: string, v: Visibility) {
    await fs.rm(this.file(key, v), { force: true });
  }
  async signedUrl(key: string, ttlSeconds: number) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/api/v1/files/private/${key}?exp=${exp}&sig=${signPrivate(key, exp)}`;
  }
}

/** S3-compatible driver (AWS S3, Cloudflare R2, Backblaze B2). Loaded lazily to keep dev light. */
class S3Driver implements StorageDriver {
  private clientPromise = (async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  })();
  private bucket = process.env.S3_BUCKET ?? "";
  private k(key: string, v: Visibility) {
    assertSafeKey(key);
    return `${v}/${key}`;
  }
  async put(key: string, body: Buffer, contentType: string, v: Visibility) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.k(key, v),
        Body: body,
        ContentType: contentType,
        CacheControl: v === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
      }),
    );
  }
  async get(key: string, v: Visibility) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const out = await (await this.clientPromise).send(new GetObjectCommand({ Bucket: this.bucket, Key: this.k(key, v) }));
      const bytes = await out.Body!.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: out.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  async delete(key: string, v: Visibility) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.k(key, v) }));
  }
  async signedUrl(key: string, ttlSeconds: number) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return getSignedUrl(await this.clientPromise, new GetObjectCommand({ Bucket: this.bucket, Key: this.k(key, "private") }), {
      expiresIn: ttlSeconds,
    });
  }
}

/**
 * Keeps files in Postgres. Meant for free hosting whose disk is wiped on every restart: photos and
 * videos survive restarts and deploys with no extra account to set up. Object storage (the S3 driver
 * with Cloudflare R2) is still the better choice once the site has real traffic.
 */
export class DatabaseDriver implements StorageDriver {
  async put(key: string, body: Buffer, contentType: string, visibility: Visibility) {
    assertSafeKey(key);
    const bytes = new Uint8Array(body);
    await db.storedFile.upsert({
      where: { visibility_key: { visibility, key } },
      create: { visibility, key, contentType, size: body.length, body: bytes },
      update: { contentType, size: body.length, body: bytes },
    });
  }
  async get(key: string, visibility: Visibility) {
    assertSafeKey(key);
    const row = await db.storedFile.findUnique({ where: { visibility_key: { visibility, key } }, select: { body: true, contentType: true } });
    return row ? { body: Buffer.from(row.body), contentType: row.contentType } : null;
  }
  async delete(key: string, visibility: Visibility) {
    assertSafeKey(key);
    await db.storedFile.deleteMany({ where: { visibility, key } });
  }
  async signedUrl(key: string, ttlSeconds: number) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/api/v1/files/private/${key}?exp=${exp}&sig=${signPrivate(key, exp)}`;
  }
}

export function signPrivate(key: string, exp: number) {
  return hmac(`private:${key}:${exp}`).slice(0, 40);
}

export function verifyPrivateSignature(key: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signPrivate(key, exp), sig);
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  driver ??= env.storageDriver === "s3" ? new S3Driver() : env.storageDriver === "database" ? new DatabaseDriver() : new LocalDriver();
  return driver;
}

export const IMAGE_WIDTHS = [480, 960, 1600] as const;

/** Public URL of an image variant. Uses the CDN when configured, otherwise the app's file route. */
export function publicImageUrl(baseKey: string, width: (typeof IMAGE_WIDTHS)[number] = 960): string {
  if (baseKey.endsWith(".svg")) {
    return env.storagePublicBaseUrl ? `${env.storagePublicBaseUrl}/public/${baseKey}` : `/api/v1/files/public/${baseKey}`;
  }
  const key = `${baseKey}-${width}.webp`;
  return env.storagePublicBaseUrl ? `${env.storagePublicBaseUrl}/public/${key}` : `/api/v1/files/public/${key}`;
}

/** Public URL of any public object (videos, posters). Uses the CDN when configured. */
export function publicFileUrl(key: string): string {
  return env.storagePublicBaseUrl ? `${env.storagePublicBaseUrl}/public/${key}` : `/api/v1/files/public/${key}`;
}
