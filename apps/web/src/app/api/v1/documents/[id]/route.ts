import { NextResponse } from "next/server";
import { handler } from "@/server/http";
import { getDocumentAccessUrl } from "@/server/services/properties";

/** Redirects to a short-lived signed URL after checking access. */
export const GET = handler<{ id: string }>(async (ctx) => {
  const url = await getDocumentAccessUrl(ctx.actor, ctx.params.id, ctx.ipHash);
  if (ctx.req.nextUrl.searchParams.get("format") === "json") return { url, expiresIn: 300 };
  return NextResponse.redirect(new URL(url, ctx.req.url), { status: 302 });
});
