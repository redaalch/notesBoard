/**
 * Validate that a redirect path is safe (same-origin, no protocol-relative).
 *
 * Prevents open-redirect attacks where an attacker crafts a URL like
 * `//evil.com` or `/\evil.com` that browsers resolve as an external URL.
 */
export function isSafeRedirect(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  // Must start with exactly one `/` — reject `//`, `/\`, and absolute URLs
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\"))
    return false;
  // Final check: ensure the browser resolves it to the current origin
  try {
    const resolved = new URL(path, window.location.origin);
    return resolved.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Return `path` if it is a safe internal redirect, otherwise `fallback`.
 */
export function safeRedirectPath(
  path: unknown,
  fallback = "/app",
): string {
  return isSafeRedirect(path) ? path : fallback;
}
