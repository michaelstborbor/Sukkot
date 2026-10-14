import { handler } from "@/server/http";
import { addAgencyMember, removeAgencyMember } from "@/server/services/agency";

export const POST = handler(async (ctx) => addAgencyMember(ctx.actor, await ctx.req.json().catch(() => ({}))));
export const DELETE = handler(async (ctx) => removeAgencyMember(ctx.actor, ctx.req.nextUrl.searchParams.get("id") ?? ""));
