/**
 * Only a same-site path may be used as a post-sign-in destination.
 *
 * The auth routes finish with `redirect(origin + next)`. A `next` that does
 * not start with a single "/" can turn that into a different host (for
 * example a value starting with "@" makes the browser read our own hostname
 * as a username), so anything that is not a plain path falls back.
 */
export function safeNext(raw: string | null | undefined, fallback = "/feed"): string {
  if (!raw) return fallback;
  const v = raw.trim();
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(v)) return fallback;
  return v;
}
