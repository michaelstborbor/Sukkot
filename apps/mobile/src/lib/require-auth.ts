import { router, type Href } from "expo-router";
import type { MeDTO } from "@sukkot/shared";

/** Navigate to `href` if signed in, otherwise to sign-in first. */
export function goSignedIn(user: MeDTO | null, href: Href) {
  if (user) router.push(href);
  else router.push("/sign-in");
}
