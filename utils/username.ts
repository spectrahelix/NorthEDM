/**
 * The one definition of a valid username. It used to be copy-pasted into the
 * signup page, the signup route and both forum composers; keep them importing
 * from here so the rules can't drift.
 */
export const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;
export const USERNAME_RULES = "2–20 characters: letters, numbers and underscores.";

const RESERVED = new Set([
  "admin", "administrator", "northedm", "festdash", "festeats", "support", "help", "root", "api",
  "system", "moderator", "mod", "staff", "owner", "official", "null", "undefined", "me", "you",
  "anonymous", "guest", "deleted",
]);

/** Null when the username is acceptable, otherwise the message to show. */
export function usernameProblem(raw: string): string | null {
  const v = raw.trim();
  if (!USERNAME_RE.test(v)) return USERNAME_RULES;
  if (RESERVED.has(v.toLowerCase())) return "That name is reserved — pick another.";
  return null;
}

/** A starting suggestion from an email address: the part before @, cleaned. */
export function suggestUsername(email?: string | null): string {
  const prefix = (email ?? "").split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
  return prefix.length >= 2 ? prefix : "";
}
