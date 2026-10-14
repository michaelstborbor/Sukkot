import { storage, verifyPrivateSignature } from "@/server/storage";

/** Local-driver signed URLs for private documents. Expired or tampered links are refused. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  const k = key.join("/");
  if (!verifyPrivateSignature(k, exp, sig)) return new Response("Link expired or invalid", { status: 403 });
  let file;
  try {
    file = await storage().get(k, "private");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "private, no-store",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
