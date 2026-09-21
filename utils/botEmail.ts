/**
 * Bot / throwaway email screening for the ONE form guests can reach: the
 * sign-in help request at /signin-help.
 *
 * That form has to stay open — the people who need it are by definition locked
 * out of an account — so it can't be gated on being signed in. Screening the
 * address is what's left.
 *
 * Design rule, same as the bug-report filter: a false negative costs one junk
 * row in a queue; a false positive locks a real person out of the only door
 * they have left. So every rule here is narrow and structural (malformed,
 * known-disposable, obvious garbage), never "this looks a bit odd".
 */

// Domains that exist to be thrown away. Deliberately a known-bad list rather
// than a cleverness heuristic — a real person on a small mail host must not be
// mistaken for a bot.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "spamgourmet.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "burnermail.io",
]);

// Addresses that only ever appear in documentation and automated form-fills.
const PLACEHOLDER_LOCAL_PARTS = new Set([
  "test",
  "tester",
  "testing",
  "example",
  "asdf",
  "asdfasdf",
  "qwerty",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "admin",
  "root",
  "postmaster",
  "abuse",
]);

// RFC-reserved domains that can never receive mail (RFC 2606 / 6761).
const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org", "test", "invalid", "localhost"]);

// Deliberately permissive: real addresses contain things naive patterns reject
// (plus tags, apostrophes, long TLDs). This only catches genuinely malformed.
const EMAIL_SHAPE = /^[^\s@,;:<>()[\]\\]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export type EmailVerdict = { ok: true; email: string } | { ok: false; reason: string };

export function screenEmail(raw: string): EmailVerdict {
  const email = String(raw || "").trim().toLowerCase();

  if (!email) return { ok: false, reason: "Please enter your email address." };
  if (email.length > 254) return { ok: false, reason: "That email address is too long." };
  if (!EMAIL_SHAPE.test(email)) return { ok: false, reason: "That doesn't look like a valid email address." };

  const [local, domain] = email.split("@");

  if (RESERVED_DOMAINS.has(domain)) {
    return { ok: false, reason: "That address can't receive mail — please use a real inbox." };
  }
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "Please use a permanent email address, not a disposable one." };
  }
  if (PLACEHOLDER_LOCAL_PARTS.has(local)) {
    return { ok: false, reason: "Please use your own email address so we can write back." };
  }
  // Long unbroken consonant runs are a reliable tell for generated addresses
  // ("RRGGjngSzprVvwUrUvvKUOJ" — an actual junk submission this site received).
  // Six is high enough that real words and most names pass; "Schwartz" has 4.
  if (/[bcdfghjklmnpqrstvwxz]{7,}/i.test(local)) {
    return { ok: false, reason: "That doesn't look like a valid email address." };
  }

  return { ok: true, email };
}

/**
 * Free-text screening for the optional description. Kept separate from the
 * email check so a real person with a terse message ("cant log in") is never
 * rejected — an empty or short description is fine, it's optional.
 */
export function looksLikeGarbageText(raw: string): boolean {
  const text = String(raw || "").trim();
  if (!text) return false; // optional field — absent is not garbage
  if (text.length < 12) return false; // too short to judge; let it through
  const letters = text.replace(/[^a-z]/gi, "");
  if (letters.length < 10) return false;
  // No vowels at all across a substantial run of letters = keyboard mash.
  if (!/[aeiou]/i.test(letters)) return true;
  // A single token of 25+ characters with no spaces anywhere.
  if (!/\s/.test(text) && text.length > 40) return true;
  return false;
}
