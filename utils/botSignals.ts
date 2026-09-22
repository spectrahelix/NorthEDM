/**
 * Structural bot signals for the one form guests can reach (/signin-help).
 *
 * Measured against three real crawler sessions on 2026-09-21/22. What they did:
 *
 *   visitor 25ed25e4 — 14 pages, 14 of them distinct, in 86 seconds
 *   visitor 35eb5404 — 13 pages, 13 distinct, in 72 seconds
 *   visitor c7daa46a —  4 pages,  4 distinct, in 44 seconds
 *
 * Note hits === distinct every time: they never revisit a page. A person
 * reloads, goes back, re-reads. These walked /festdash → /feed → /feedback →
 * /marketplace → /marketplace/apply → /vendors/apply at one page per second,
 * POSTed to /api/requests three times (401 each — the verified-account gate
 * held), and submitted /signin-help with the email pasted into BOTH the email
 * box and the description box.
 *
 * They did NOT trip the honeypot, so they ignore hidden fields. These checks
 * are what's left that doesn't need a third-party service.
 *
 * Same design rule as utils/botEmail.ts, and it matters more here: a junk row
 * costs one click to dismiss, a false positive locks a real person out of the
 * only door they have left. So nothing here guesses at intent. Every check is
 * either physically impossible for a human, or answerable by one in a single
 * step — never a silent drop.
 */

export type Signal =
  | { kind: "reject"; reason: string }
  | { kind: "quiet" }   // store it, skip the owner alert
  | { kind: "ok" };

/** Below this, the form was not read by eyes. Typing an email alone beats it. */
const MIN_ELAPSED_MS = 2500;

export function checkSubmission(input: {
  elapsedMs?: unknown;
  email: string;
  description: string;
}): Signal {
  const { email, description } = input;

  // 1. Time on page. A person has to read the heading, click the box and type
  //    an address; two and a half seconds is not enough for any of that. Only
  //    applies when the client reported a number — an absent value must never
  //    reject, or every visitor with a stale cached page is locked out.
  const elapsed = typeof input.elapsedMs === "number" ? input.elapsedMs : null;
  if (elapsed !== null && elapsed >= 0 && elapsed < MIN_ELAPSED_MS) {
    return {
      kind: "reject",
      reason: "That was submitted faster than the form could be read. If you're a person, please try once more.",
    };
  }

  // 2. Description identical to the email. All three crawlers did this — it is
  //    what a script does when it fills every text input with the same seed
  //    value. A confused person might too, so this asks rather than refuses:
  //    answerable in one step by a human, ignored by a bot.
  const desc = description.trim().toLowerCase();
  if (desc && desc === email.trim().toLowerCase()) {
    return {
      kind: "reject",
      reason: "We have your email already — could you tell us what happens when you try to sign in?",
    };
  }

  return { kind: "ok" };
}

/**
 * Client IP from the proxy headers Vercel sets. Returns null rather than a
 * placeholder when absent, so a missing header can never collapse every
 * visitor into one shared rate-limit bucket.
 */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const real = headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 45) : null;
}

/**
 * Does the client contradict itself about what it is?
 *
 * Every Chromium browser (Chrome, Edge, Brave, Opera) sends `sec-ch-ua` on a
 * secure origin — it is not optional and not something the page controls. A
 * script that sets a Chrome user-agent string by hand almost never sends it.
 * So a UA claiming Chromium with no `sec-ch-ua` header is a client lying about
 * itself.
 *
 * Checked ONLY against Chromium UA strings. Firefox and Safari legitimately
 * never send `sec-ch-ua`, so testing them would flag every real visitor on
 * either browser — which is exactly the false positive this file exists to
 * avoid. All three crawlers here claimed `Chrome/142.0.0.0`.
 */
export function clientContradictsItself(headers: Headers): boolean {
  const ua = headers.get("user-agent") ?? "";
  if (!ua) return false; // absent UA is odd but not a contradiction — don't judge
  const claimsChromium = /\bChrome\/\d|\bEdg\/\d|\bOPR\/\d/.test(ua);
  if (!claimsChromium) return false;
  return !headers.get("sec-ch-ua");
}

/**
 * Per-IP throttle backed by public.request_throttle.
 *
 * Returns true when this caller is OVER the limit. Records the attempt first,
 * so the current request counts toward its own bucket.
 *
 * Fails OPEN on any database trouble and on a missing IP: a throttle that
 * starts rejecting because a count query failed would take down the very forms
 * it protects, and a null IP would pool every visitor into one bucket and
 * rate-limit the whole site as a single caller.
 */
export async function overRateLimit(
  bucket: string,
  ip: string | null,
  opts: { max: number; windowMs: number }
): Promise<boolean> {
  if (!ip) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  // Its own client so callers need pass nothing but the bucket and IP — the
  // concrete client type differs between call sites and threading it through
  // bought nothing but generic mismatches.
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await db.from("request_throttle").insert({ bucket, ip });

    const since = new Date(Date.now() - opts.windowMs).toISOString();
    const { count, error } = await db
      .from("request_throttle")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .eq("ip", ip)
      .gte("created_at", since);

    if (error) return false;

    // Prune this key's old rows so the table stays bounded without needing a
    // scheduled job. Index-scoped, so the cost is negligible.
    await db
      .from("request_throttle")
      .delete()
      .eq("bucket", bucket)
      .eq("ip", ip)
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return (count ?? 0) > opts.max;
  } catch {
    return false;
  }
}

/**
 * A Gmail address carrying more dots than a person would ever type.
 *
 * Gmail ignores dots in the local part: b.ri.d.get.c.o.wan07@gmail.com and
 * bridgetcowan07@gmail.com are the same inbox. That makes dot insertion the
 * cheapest way to mint unlimited distinct-looking addresses that all deliver
 * to one mailbox, and three of the four crawler submissions used it:
 *
 *   f.i.derada.xi.02@gmail.com      4 dots
 *   ja.lb.rec.h.t8.2.1@gmail.com    6 dots
 *   b.ri.d.get.c.o.wan07@gmail.com  6 dots
 *
 * Real addresses are first.last (1) or first.m.last (2). Four is well clear of
 * anything a person types about their own address, and because Gmail ignores
 * the dots, even a genuine holder of such an address can write it with fewer.
 *
 * Gmail and googlemail only. Dots are meaningful local-part characters
 * everywhere else, so applying this to other hosts would flag real people.
 */
export function implausibleGmailDots(email: string): boolean {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return false;
  if (domain !== "gmail.com" && domain !== "googlemail.com") return false;
  // Ignore a +tag, which is a normal thing to have and not part of the name.
  const base = local.split("+")[0] ?? local;
  return (base.match(/\./g) ?? []).length >= 4;
}
