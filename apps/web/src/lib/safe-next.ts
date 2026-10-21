/**
 * Where to send someone after signing in: only a path on this site. Rejects protocol-relative and
 * backslash forms ("//evil.com", "/\\evil.com") and control characters, which browsers treat as
 * another host.
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "https://sukkot.invalid");
    if (url.origin !== "https://sukkot.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
