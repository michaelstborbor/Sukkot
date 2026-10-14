import { NextResponse } from "next/server";
import { handler } from "@/server/http";
import { verificationDocumentUrl } from "@/server/services/verification";

export const GET = handler<{ id: string }>(async (ctx) => {
  const url = await verificationDocumentUrl(ctx.actor, ctx.params.id, ctx.ipHash);
  return NextResponse.redirect(new URL(url, ctx.req.url), { status: 302 });
});
