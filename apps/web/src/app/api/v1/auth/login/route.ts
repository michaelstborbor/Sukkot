import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { login } from "@/server/services/auth";
import { authResponse } from "../_shared";

export const POST = handler(async (ctx) => {
  await ctx.limit("login", LIMITS.login);
  const mobile = ctx.req.headers.get("x-client") === "mobile";
  const body = await ctx.req.json().catch(() => ({}));
  const { token, expiresAt } = await login(body, { client: mobile ? "mobile" : "web", userAgent: ctx.req.headers.get("user-agent"), ipHash: ctx.ipHash });
  return authResponse(token, expiresAt, mobile);
});
