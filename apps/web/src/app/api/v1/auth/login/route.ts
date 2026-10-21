import { handler } from "@/server/http";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { login } from "@/server/services/auth";
import { authResponse } from "../_shared";

export const POST = handler(async (ctx) => {
  const mobile = ctx.req.headers.get("x-client") === "mobile";
  const body = await ctx.req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  await ctx.limit("login-ip", LIMITS.loginIp);
  await ctx.limit("login", LIMITS.login, email);
  // Per account, whatever address the guesses come from.
  if (email) await rateLimit(`login-account:${email}`, LIMITS.loginAccount.limit, LIMITS.loginAccount.window);
  const { token, expiresAt } = await login(body, { client: mobile ? "mobile" : "web", userAgent: ctx.req.headers.get("user-agent"), ipHash: ctx.ipHash });
  return authResponse(token, expiresAt, mobile);
});
