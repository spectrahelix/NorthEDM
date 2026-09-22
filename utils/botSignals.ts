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
