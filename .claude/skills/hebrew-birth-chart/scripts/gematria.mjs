#!/usr/bin/env node
// Standard Hebrew gematria — deterministic, no network.
//   node gematria.mjs <hebrew text>   → letters, addends, total
//   node gematria.mjs --test          → runs the fixtures from reference/spec.md §13
// Imported by render-chart.mjs so every number in a PDF is recomputed here.

const LETTER_VALUES = Object.freeze({
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40,
  נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80,
  צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400,
});

// Geresh/gershayim (׳ ״ and the ASCII ' ") mark a borrowed sound (צ׳ = "ch",
// ג׳ = "j") or a numeral; they carry no value. Maqaf ־ and sof pasuq ׃ likewise.
const NO_VALUE = /[\s\p{P}׳״־׃'"`]/u;

export function calculateGematria(input) {
  if (typeof input !== "string") throw new Error("Input must be text.");
  // NFKD splits presentation forms (e.g. U+FB2A שׁ) into letter + mark;
  // then drop niqqud and cantillation (all \p{M}).
  const normalized = input.normalize("NFKD").replace(/\p{M}/gu, "");
  const letters = [];
  for (const ch of normalized) {
    const value = LETTER_VALUES[ch];
    if (value !== undefined) letters.push({ letter: ch, value });
    else if (NO_VALUE.test(ch)) continue;
    else if (/\d/.test(ch)) throw new Error("Digits go to Number Lookup, not gematria.");
    else throw new Error(`Not a Hebrew letter: "${ch}". Choose a conversion mode first.`);
  }
  if (letters.length === 0) throw new Error("Enter at least one Hebrew letter.");
  return {
    method: "standard-hebrew-gematria",
    normalizedHebrew: letters.map((l) => l.letter).join(""),
    letters,
    addends: letters.map((l) => l.value).join(" + "),
    total: letters.reduce((s, l) => s + l.value, 0),
  };
}

export const FIXTURES = [
  ["אב", 3], ["אהבה", 13], ["טוב", 17], ["חי", 18], ["חיה", 23], ["אדם", 45],
  ["אדנים", 105], ["האמונה", 107], ["אחרי", 219], ["מרום", 286], ["שלוה", 341],
  ["שלווה", 347], ["אשף", 381], ["עשן", 420], ["עָשָׁן", 420], ["החמישי", 373],
  ["השבת", 707],
  // Example-chart spellings (Charles Jackson Lewis V)
  ["צ׳ארלס", 381], ["ג׳קסון", 219], ["לואיס", 107],
  // Every final letter, and a presentation form (U+FB2A = שׁ)
  ["ךםןףץ", 280], ["שׁ", 300], ["חַי, חי!", 36],
];

function runTests() {
  let failed = 0;
  for (const [text, expected] of FIXTURES) {
    const r = calculateGematria(text);
    const sum = r.letters.reduce((s, l) => s + l.value, 0);
    const ok = r.total === expected && sum === r.total;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${text} = ${r.total} (expected ${expected})`);
  }
  for (const bad of ["", "abc", "חי5", "<b>חי</b>"]) {
    let threw = false;
    try { calculateGematria(bad); } catch { threw = true; }
    if (!threw) failed++;
    console.log(`${threw ? "ok  " : "FAIL"} rejects ${JSON.stringify(bad)}`);
  }
  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.slice(2).join(" ");
  if (arg === "--test") runTests();
  else if (!arg) { console.error("usage: gematria.mjs <hebrew> | --test"); process.exit(2); }
  else console.log(JSON.stringify(calculateGematria(arg), null, 2));
}
