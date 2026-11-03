// Standard Hebrew gematria — the one implementation. The calculator page,
// its API routes and the agent skill (.claude/skills/hebrew-birth-chart) all
// import this file; don't paste the table anywhere else.
//
// Erasable TypeScript only (no enums/namespaces) so Node can run it directly
// for the skill and the test script.

export const GEMATRIA_METHOD = "standard-hebrew-gematria";

export const LETTER_VALUES: Readonly<Record<string, number>> = Object.freeze({
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40,
  נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80,
  צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400,
});

// Geresh/gershayim (׳ ״ and ASCII ' "), maqaf ־ and sof pasuq ׃ carry no value:
// צ׳ = "ch", ג׳ = "j", ט״ו = 15.
const NO_VALUE = /[\s\p{P}׳״־׃'"`]/u;

export type GematriaLetter = { letter: string; value: number };
export type GematriaResult = {
  method: typeof GEMATRIA_METHOD;
  normalizedHebrew: string;
  letters: GematriaLetter[];
  addends: string;
  total: number;
};

export class GematriaInputError extends Error {}

export function calculateGematria(input: string): GematriaResult {
  if (typeof input !== "string") throw new GematriaInputError("Input must be text.");
  // NFKD splits presentation forms (e.g. U+FB2A שׁ) into letter + mark,
  // then every combining mark (niqqud, cantillation) is dropped.
  const normalized = input.normalize("NFKD").replace(/\p{M}/gu, "");
  const letters: GematriaLetter[] = [];
  for (const ch of normalized) {
    const value = LETTER_VALUES[ch];
    if (value !== undefined) letters.push({ letter: ch, value });
    else if (NO_VALUE.test(ch)) continue;
    else if (/\d/.test(ch)) throw new GematriaInputError("Numbers go to Number Lookup, not gematria.");
    else throw new GematriaInputError(`"${ch}" isn't a Hebrew letter. Use Write the sound to turn English into Hebrew letters first.`);
  }
  if (letters.length === 0) throw new GematriaInputError("Enter at least one Hebrew letter.");
  return {
    method: GEMATRIA_METHOD,
    normalizedHebrew: letters.map((l) => l.letter).join(""),
    letters,
    addends: letters.map((l) => l.value).join(" + "),
    total: letters.reduce((s, l) => s + l.value, 0),
  };
}

/** Value or null — for filtering lists where a bad entry should just be skipped. */
export function gematriaOrNull(input: string): number | null {
  try {
    return calculateGematria(input).total;
  } catch {
    return null;
  }
}

// ---------- Hebrew numerals (ט״ו, ה׳תשס״ב) ----------

const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת"];

/** Letters for 1–999, with 15 → טו and 16 → טז (the divine-name custom). */
function lettersFor(n: number): string {
  let out = "";
  let h = Math.floor(n / 100);
  while (h > 4) { out += "ת"; h -= 4; }
  out += HUNDREDS[h];
  const rest = n % 100;
  if (rest === 15) return out + "טו";
  if (rest === 16) return out + "טז";
  return out + TENS[Math.floor(rest / 10)] + ONES[rest % 10];
}

function punctuate(s: string): string {
  return s.length === 1 ? s + "׳" : s.slice(0, -1) + "״" + s.slice(-1);
}

/**
 * Conventional Hebrew numeral notation. Years over 999 put the thousands
 * before a geresh: 5762 → ה׳תשס״ב. 0 has no letter form (returns "").
 */
export function hebrewNumeral(n: number, opts: { thousands?: boolean } = {}): string {
  if (!Number.isInteger(n) || n <= 0) return "";
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const body = rest ? punctuate(lettersFor(rest)) : "";
  if (thousands && opts.thousands !== false) return punctuate(lettersFor(thousands)).replace(/״(.)$/, "$1׳").replace(/^(.)׳?$/, "$1׳") + body;
  return body;
}

// ---------- Numbers in Hebrew words (standalone, feminine counting form) ----------
// The standalone form used when counting ("אחת, שתיים, שלוש…"), which is the
// documented default for a bare number in modern Hebrew.

const W_ONES = ["", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע"];
const W_TEENS = ["עשר", "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה", "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה"];
const W_TENS = ["", "", "עשרים", "שלושים", "ארבעים", "חמישים", "שישים", "שבעים", "שמונים", "תשעים"];
const W_HUNDREDS = ["", "מאה", "מאתיים", "שלוש מאות", "ארבע מאות", "חמש מאות", "שש מאות", "שבע מאות", "שמונה מאות", "תשע מאות"];
const W_THOUSANDS = ["", "אלף", "אלפיים", "שלושת אלפים", "ארבעת אלפים", "חמשת אלפים", "ששת אלפים", "שבעת אלפים", "שמונת אלפים", "תשעת אלפים"];

function joinWithVav(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return parts.slice(0, -1).join(" ") + " ו" + parts[parts.length - 1];
}

/** 0–9,999 in Hebrew words. */
export function hebrewNumberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new RangeError("Use a whole number from 0 to 9,999.");
  if (n === 0) return "אפס";
  const parts: string[] = [];
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), r = n % 100;
  if (th) parts.push(W_THOUSANDS[th]);
  if (h) parts.push(W_HUNDREDS[h]);
  if (r >= 10 && r < 20) parts.push(W_TEENS[r - 10]);
  else {
    if (Math.floor(r / 10)) parts.push(W_TENS[Math.floor(r / 10)]);
    if (r % 10) parts.push(W_ONES[r % 10]);
  }
  return joinWithVav(parts);
}
