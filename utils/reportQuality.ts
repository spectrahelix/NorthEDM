// Low-effort/garbage submission detection for bug reports & feedback.
//
// DESIGN RULE: false negatives are cheap, false positives are NOT. Letting a
// little junk through costs the owner one glance; rejecting somebody's real bug
// report loses information forever and insults the reporter. So every check here
// is deliberately conservative: text is rejected only when it shows a *strong*
// keyboard-mash signal AND contains almost no real words. Anything that reads
// like English — or like a pasted URL, error message, or stack trace — passes.

const VOWELS = /[aeiouy]/i;

/** Tokens that look like real words: alphabetic, sane length, has a vowel. */
function realWords(text: string): string[] {
  return text
    .split(/[\s/\\_\-.,;:!?()[\]{}'"]+/)
    .filter((t) => /^[a-z']{2,20}$/i.test(t) && VOWELS.test(t));
}

function longestRun(text: string, re: RegExp): number {
  let best = 0;
  for (const m of text.matchAll(re)) best = Math.max(best, m[0].length);
  return best;
}

/** Consecutive keyboard-row runs (asdf, qwer, zxcv, 1234, hjkl…). */
function hasKeyboardRun(lower: string): boolean {
  const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
  for (const row of rows) {
    for (let i = 0; i + 4 <= row.length; i++) {
      const seq = row.slice(i, i + 4);
      if (lower.includes(seq) || lower.includes([...seq].reverse().join(""))) return true;
    }
  }
  return false;
}

/**
 * True only for text that is almost certainly a keyboard mash / filler.
 * `minWords` real words always passes — that's the anti-false-positive floor.
 */
export function isGarbageText(raw: string, opts: { minWords?: number } = {}): boolean {
  const text = (raw || "").trim();
  if (!text) return true;

  const minWords = opts.minWords ?? 2;
  const words = realWords(text);

  // Enough real words → always accept. This is the main false-positive guard.
  if (words.length >= Math.max(minWords, 3)) return false;
  if (words.length >= minWords && text.length >= 25) return false;

  // Looks like a URL, path, or error/stack text → accept (often word-poor but useful).
  if (/https?:\/\/|^\/[\w-]|(?:Error|Exception|undefined|null|NaN|\bat\s+\w+\()/i.test(text)) return false;

  const lower = text.toLowerCase();
  const letters = text.replace(/[^a-z]/gi, "");

  // Strong mash signals.
  const signals = [
    longestRun(lower, /[bcdfghjklmnpqrstvwxz]+/g) >= 6,          // consonant pile-up
    longestRun(lower, /(.)\1+/g) >= 5,                            // "aaaaaaa"
    hasKeyboardRun(lower),                                        // asdf / qwer
    letters.length >= 10 && (letters.match(/[aeiouy]/gi)?.length ?? 0) / letters.length < 0.12,
    // Random-case mashing inside one long token, e.g. "GElgPHJLGHMzsgNgw"
    /^\S{8,}$/.test(text) && (text.match(/(?:[a-z][A-Z]|[A-Z][a-z])/g)?.length ?? 0) >= 4,
  ];

  return signals.some(Boolean);
}

/**
 * Validate one required free-text field. Returns an error message, or null if OK.
 * `label` is shown to the reporter so the bounce-back is actionable.
 */
export function validateField(
  value: string,
  label: string,
  { min = 10, minWords = 2 }: { min?: number; minWords?: number } = {}
): string | null {
  const text = (value || "").trim();
  if (!text) return `${label} is required.`;
  if (text.length < min) return `${label} needs a bit more detail (at least ${min} characters).`;
  if (isGarbageText(text, { minWords })) {
    return `${label} doesn't look like a real description — please describe it in your own words.`;
  }
  return null;
}
