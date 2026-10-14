import { storage } from "@/server/storage";

/** Serves public images when no CDN is configured. Keys are validated by the storage driver. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  let file;
  try {
    file = await storage().get(key.join("/"), "public");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      // Served images can never run script, even if a crafted SVG were ever stored.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
