/**
 * Supabase's auth errors are written for developers. Say something a person can
 * act on instead — and keep one copy of that wording, because signup and
 * password reset hit the same provider rules from opposite ends of the site.
 */
export function humaniseAuthError(message: string): string {
  // Length first. Supabase reports a breached password as "...known to be weak
  // and easy to guess...", which is a password fault but NOT a length fault, so
  // a single rule matching /weak/ answers it with "choose at least 6
  // characters" — advice that makes no sense to someone whose password is
  // already eleven characters long. Leaked-password protection (enabled
  // 2026-09-21) makes that branch reachable, so the two stay separate.
  if (/password/i.test(message) && /short|at least|minimum|too small/i.test(message)) {
    return "Please choose a password of at least 6 characters.";
  }
  if (/password/i.test(message) && /weak|leak|pwned|breach|compromis|easy to guess/i.test(message)) {
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
