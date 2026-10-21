import { NextResponse, type NextRequest } from "next/server";
import { IOS_APP_COOKIE, IOS_APP_HEADER } from "@/lib/ios-app";

/**
 * The iPhone app opens website pages with `?app=ios`. Remember that for the rest of the visit (the
 * in-app browser keeps its own cookies), so plans, promotions, listing slots and listing fees stay
 * hidden there, as Apple requires. Runs only on requests that carry the `app` query.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.searchParams.get("app") !== "ios") return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set(IOS_APP_HEADER, "1");
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(IOS_APP_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/" });
  return res;
}

export const config = { matcher: [{ source: "/((?!_next/|api/).*)", has: [{ type: "query", key: "app" }] }] };
