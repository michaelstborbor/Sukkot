import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { register } from "@/server/services/auth";
import { authResponse } from "../_shared";

export const POST = handler(async (ctx) => {
  await ctx.limit("register", LIMITS.register);
  const mobile = ctx.req.headers.get("x-client") === "mobile";
  const body = await ctx.req.json().catch(() => ({}));
  const { token, expiresAt } = await register(body, { client: mobile ? "mobile" : "web", userAgent: ctx.req.headers.get("user-agent"), ipHash: ctx.ipHash });
  return authResponse(token, expiresAt, mobile);
});
