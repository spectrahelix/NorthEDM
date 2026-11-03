// "Write the sound": a rule-based FIRST GUESS at spelling an English name in
// Hebrew letters. It is a suggestion the person edits, never a translation of
// the name's meaning. English spelling doesn't fix pronunciation (the "ch" in
// Charles vs Christopher), so ambiguous spots return alternatives.

const FINALS: Record<string, string> = { כ: "ך", מ: "ם", נ: "ן", פ: "ף", צ: "ץ" };

function finalize(word: string): string {
  // Final form only on the last letter; a geresh after צ׳/ג׳ keeps the regular form.
  if (!word) return word;
  const last = word.slice(-1);
  return FINALS[last] ? word.slice(0, -1) + FINALS[last] : word;
}

type Rule = [RegExp, string | ((m: RegExpExecArray, i: number, w: string) => string)];

const VOWEL = /[aeiouy]/;

// Ordered: longest/most specific first. Applied left to right.
const RULES: Rule[] = [
  [/^chr/, "כר"], // Christopher, Chris
  [/^ch(?=[aeiou])/, "צ׳"], // Charles (English ch)
  [/^sch/, "ש"],
  [/^tch/, "צ׳"],
  [/^ch/, "צ׳"],
  [/^sh/, "ש"],
  [/^th/, "ת"],
  [/^ph/, "פ"],
  [/^tz|^ts/, "צ"],
  [/^ck/, "ק"],
  [/^qu/, "קו"],
  [/^gh/, ""],
  [/^kn/, "נ"],
  [/^wr/, "ר"],
  [/^x/, "קס"],
  [/^j/, "ג׳"],
  [/^c(?=[eiy])/, "ס"],
  [/^c/, "ק"],
  [/^k/, "ק"],
  [/^q/, "ק"],
  [/^g(?=[eiy])/, "ג"],
  [/^g/, "ג"],
  [/^b/, "ב"], [/^d/, "ד"], [/^f/, "פ"], [/^l/, "ל"], [/^m/, "מ"], [/^n/, "נ"],
  [/^p/, "פ"], [/^r/, "ר"], [/^s/, "ס"], [/^t/, "ט"], [/^v/, "ו"], [/^w/, "ו"], [/^z/, "ז"],
  [/^ah$/, "ה"], // Sarah, Hannah
  [/^h/, (_m, i) => (i === 0 ? "ה" : "")],
  // vowels
  [/^(ee|ea|ie|i)/, "י"],
  [/^(oo|ou|o|u)/, "ו"],
  [/^ay|^ai|^ey|^ei/, "יי"],
  [/^y(?=[aeiou])/, "י"],
  [/^y/, "י"],
  [/^a/, (_m, i, w) => (i === w.length - 1 ? "ה" : "")],
  [/^e/, (_m, i, w) => (i === w.length - 1 ? "" : "")],
];

function word(raw: string): string {
  // Doubled consonants are one sound (Hannah, Jesse, Burr).
  const w = raw.replace(/([b-df-hj-np-tv-z])\1/g, "$1");
  let out = "";
  let i = 0;
  // A word that starts with a vowel needs an aleph to carry it.
  if (VOWEL.test(w[0] ?? "") && w[0] !== "y") out += "א";
  while (i < w.length) {
    const rest = w.slice(i);
    let matched = false;
    for (const [re, rep] of RULES) {
      const m = re.exec(rest);
      if (!m) continue;
      out += typeof rep === "function" ? rep(m, i, w) : rep;
      i += m[0].length || 1;
      matched = true;
      break;
    }
    if (!matched) i++; // drop anything else (apostrophes, hyphens)
  }
  return finalize(out.replace(/ו{3,}/g, "וו").replace(/י{3,}/g, "יי"));
}

// Names that ARE Hebrew names: their original spelling is offered as an
// alternative (labelled), never silently swapped in for the sound.
const HEBREW_ORIGINALS: Record<string, string> = {
  aaron: "אהרן", abigail: "אביגיל", abraham: "אברהם", adam: "אדם", asher: "אשר",
  benjamin: "בנימין", caleb: "כלב", daniel: "דניאל", david: "דוד", deborah: "דבורה",
  dinah: "דינה", eli: "עלי", elijah: "אליהו", elizabeth: "אלישבע", esther: "אסתר",
  ethan: "איתן", eve: "חוה", ezra: "עזרא", gabriel: "גבריאל", gideon: "גדעון",
  hannah: "חנה", isaac: "יצחק", isaiah: "ישעיהו", jacob: "יעקב", jeremiah: "ירמיהו",
  jesse: "ישי", john: "יוחנן", jonathan: "יונתן", joseph: "יוסף", joshua: "יהושע",
  josiah: "יאשיהו", judith: "יהודית", leah: "לאה", levi: "לוי", micah: "מיכה",
  michael: "מיכאל", miriam: "מרים", naomi: "נעמי", nathan: "נתן", noah: "נח",
  rachel: "רחל", raphael: "רפאל", rebecca: "רבקה", ruth: "רות", samuel: "שמואל",
  sarah: "שרה", seth: "שת", simon: "שמעון", tamar: "תמר", zachary: "זכריה",
};

export type SpellingSuggestion = { hebrew: string; note?: string };

/** Suggestions for one name component; the first is the default. */
export function suggestHebrewSpellings(name: string): SpellingSuggestion[] {
  const w = name.toLowerCase().normalize("NFKD").replace(/[^a-z' -]/g, "").trim();
  if (!w) return [];
  const main = w.split(/[\s-]+/).map(word).join(" ");
  const out: SpellingSuggestion[] = [{ hebrew: main }];
  const add = (hebrew: string, note: string) => {
    if (hebrew && !out.some((s) => s.hebrew === hebrew)) out.push({ hebrew, note });
  };
  const original = HEBREW_ORIGINALS[w];
  if (original) add(original, "the name's original Hebrew spelling");
  // Common alternatives worth offering.
  if (/^ch/.test(w) && !/^chr/.test(w)) add(main.replace(/^צ׳/, "כ"), "if the ch sounds like k");
  if (/^chr/.test(w)) add(main.replace(/^כ/, "ק"), "with ק instead of כ");
  if (/c[aou]|ck|k|q/.test(w)) add(main.replace(/ק/g, "כ").replace(/כ$/, "ך"), "with כ instead of ק");
  if (/o/.test(w)) add(main.replace(/ו(?=[^ ]*$)/, ""), "without the vav for the o");
  if (/^[aeiou]/.test(w) && main.startsWith("א") && /^e/.test(w)) add(main.replace(/^א/, "אי"), "with yod for the opening e");
  return out;
}
