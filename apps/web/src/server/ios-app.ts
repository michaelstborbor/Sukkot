import "server-only";
import { cookies, headers } from "next/headers";
import { IOS_APP_COOKIE, IOS_APP_HEADER } from "@/lib/ios-app";

/**
 * True when the page is shown inside the iPhone app. Apple only allows digital purchases (plans,
 * promotions, listing slots, listing fees) through its own in-app purchases, so these are hidden there.
 */
export async function inIosApp(): Promise<boolean> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return h.get(IOS_APP_HEADER) === "1" || c.get(IOS_APP_COOKIE)?.value === "1";
}
