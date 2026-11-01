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

/**
 * Only our own origins may be used to build the links we email to people.
 * The auth routes took `origin` straight from the request body, so a forged
 * request could have sent someone an official-looking NorthEDM email whose
 * link pointed at another host. Anything not on the list falls back to the
 * site's own address.
 */
export function safeOrigin(raw: unknown, requestUrl: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const own = new Set<string>();
  if (site) { own.add(site); own.add(site.replace("://www.", "://")); }
  let reqOrigin = "";
  try { reqOrigin = new URL(requestUrl).origin; own.add(reqOrigin); } catch { /* ignore */ }
  if (process.env.NODE_ENV !== "production") own.add("http://localhost:3000");
  const candidate = typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
  if (candidate && own.has(candidate)) return candidate;
  return site || reqOrigin;
}
