import { PASSWORD_MIN_LENGTH } from "@/utils/passwordRules";

/**
 * Supabase's auth errors are written for developers. Say something a person can
 * act on instead — and keep one copy of that wording, because signup and
 * password reset hit the same provider rules from opposite ends of the site.
 */
export function humaniseAuthError(message: string): string {
  // Password rules, in the order they can actually be acted on.
  //
  // These three are separate because Supabase's messages overlap, and lumping
  // them together produced advice that was not merely unhelpful but wrong. The
  // character-class message reads:
  //
  //   "Password should contain at least one character of each: abc..., ABC...,
  //    012..., !@#..."
  //
  // which contains the words "at least". A length rule tested first swallows
  // it, so on 2026-10-10 a real person with a TEN character password was told
  // to "choose a password of at least 6 characters" and went looking for a
  // problem that did not exist. Character classes are therefore matched first,
  // on wording only they use.
  const needsClasses = /contain at least one character/i.test(message);
  const isBreached = /password/i.test(message) && /weak|leak|pwned|breach|compromis|easy to guess/i.test(message);

  if (needsClasses) {
    const classes =
      "Your password needs a lowercase letter, an uppercase letter, a number and a symbol (like ! or ?).";
    // Both can be reported at once. Say so rather than fixing one and being
    // refused again for the other.
    return isBreached
      ? `${classes} It also appears in a known data breach, so please pick something new rather than adapting it.`
      : classes;
  }

  // Length. Quote the provider's own number instead of a hardcoded one, so
  // raising the minimum in the dashboard can never make this message a lie.
  const atLeastN = message.match(/at least (\d+) characters?/i);
  if (atLeastN) {
    return `Please choose a password of at least ${atLeastN[1]} characters.`;
  }
  if (/password/i.test(message) && /short|too small|minimum/i.test(message)) {
    return `Please choose a longer password — at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (isBreached) {
    return "That password has turned up in a known data breach, so it isn't safe to use. Please choose a different one.";
  }
  if (/email/i.test(message) && /invalid|valid/i.test(message)) {
    return "That doesn't look like a valid email address.";
  }
  if (/rate|limit|too many/i.test(message)) {
    return "Too many attempts just now — please wait a minute and try again.";
  }
  if (/sending|smtp|mail/i.test(message)) {
    return "We couldn't send your confirmation email. Use “Trouble signing in?” on the login page and we'll help directly.";
  }
  return message;
}
