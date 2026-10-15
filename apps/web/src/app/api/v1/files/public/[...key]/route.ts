import { storage } from "@/server/storage";

/** Serves public images and videos when no CDN is configured. Keys are validated by the storage driver. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  let file;
  try {
    file = await storage().get(key.join("/"), "public");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!file) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = {
    "content-type": file.contentType,
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
    // Served files can never run script, even if a crafted SVG were ever stored.
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  };
  // Browsers (Safari above all) fetch videos in byte ranges and will not play them otherwise.
  const size = file.body.length;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(new Uint8Array(file.body.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(file.body), { headers: { ...headers, "content-length": String(size) } });
}
