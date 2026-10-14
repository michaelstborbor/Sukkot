import { handler, json } from "@/server/http";
import { destroySession, SESSION_COOKIE } from "@/server/auth/session";

export const POST = handler(async (ctx) => {
  const bearer = ctx.req.headers.get("authorization")?.replace(/^Bearer /, "");
  const token = bearer ?? ctx.req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  const res = json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
