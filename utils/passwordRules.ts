/**
 * What makes a password acceptable here, in one place.
 *
 * These mirror the policy set in Supabase → Authentication → Sign In /
 * Providers → Email. Supabase is the authority; this file exists so a person
 * is TOLD the rules while typing instead of discovering them by being
 * rejected. Confirmed from the live rejection on 2026-10-10:
 *
 *   "Password should contain at least one character of each:
 *    abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789,
 *    !@#$%^&*()_+-=[]{};'\:"|<>?,./`~"
 *
 * A ten-character password was refused for missing one class, and the message
 * shown read "choose a password of at least 6 characters" — advice that could
 * not possibly help. Hence both this file and the fix in utils/authErrors.ts.
 *
 * If the dashboard policy is relaxed or tightened, update this list. A
 * mismatch is no longer silent: the server passes Supabase's own verdict
 * through unchanged, so a rule we fail to mirror shows up as a real message
 * rather than a wrong one.
 */

export const PASSWORD_MIN_LENGTH = 6;

/** Exactly the symbol set Supabase accepts, per the message above. */
const SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

export function passwordRequirements(password: string): PasswordRequirement[] {
  const pw = String(password ?? "");
  const hasSymbol = pw.split("").some((c) => SYMBOLS.includes(c));
  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: pw.length >= PASSWORD_MIN_LENGTH },
    { id: "lower", label: "A lowercase letter", met: /[a-z]/.test(pw) },
    { id: "upper", label: "An uppercase letter", met: /[A-Z]/.test(pw) },
    { id: "digit", label: "A number", met: /[0-9]/.test(pw) },
    { id: "symbol", label: "A symbol, like ! or ?", met: hasSymbol },
  ];
}

export function passwordIsValid(password: string): boolean {
  return passwordRequirements(password).every((r) => r.met);
}

/**
 * One short sentence naming what is still missing, for the cases where a list
 * isn't shown (the server, and the reset form's submit handler).
 */
export function firstPasswordProblem(password: string): string | null {
  const unmet = passwordRequirements(password).filter((r) => !r.met);
  if (!unmet.length) return null;
  if (unmet.length === 1) return `Your password still needs: ${unmet[0].label.toLowerCase()}.`;
  const labels = unmet.map((r) => r.label.toLowerCase());
  return `Your password still needs: ${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}.`;
}
