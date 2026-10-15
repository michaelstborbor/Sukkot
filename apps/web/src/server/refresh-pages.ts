import "server-only";
import { revalidatePath } from "next/cache";

/**
 * The home, locations and agents pages are cached for a few minutes. Call this after a listing goes
 * live, changes or comes down, so visitors see it straight away instead of after the cache expires.
 */
export function refreshPublicPages() {
  try {
    revalidatePath("/");
    revalidatePath("/locations", "layout");
    revalidatePath("/agents");
  } catch {
    // Outside a Next.js request (scripts, tests) there is no cache to refresh.
  }
}
