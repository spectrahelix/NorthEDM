// Hebrew word lookups over Strong's Hebrew Dictionary (Open Scriptures,
// CC BY-SA). Server-only: the data file is ~900 KB and is never sent to the
// browser. Rebuild with scripts/build-hebrew-lexicon.mjs.

import lexicon from "./data/strongs-hebrew.json" with { type: "json" };
import { calculateGematria } from "./gematria.ts";

export const LEXICON_SOURCE = {
  id: "strongs",
  label: "Strong's Hebrew Dictionary (Open Scriptures, CC BY-SA)",
  site: "github.com/openscriptures/strongs",
  url: "https://github.com/openscriptures/strongs",
};

export type LexiconEntry = {
  strongs: string; // "H6038"
  lemma: string; // with points, as in the dictionary
  consonants: string; // what the value is computed from
  xlit: string;
  definition: string;
  kjv: string;
  value: number;
  properName: boolean;
  url: string; // the entry on Bible Hub
};

type Row = [number, string, string, string, string, number];

const ENTRIES: LexiconEntry[] = (lexicon as unknown as { rows: Row[] }).rows.map(([n, lemma, xlit, definition, kjv, value]) => ({
  strongs: `H${n}`,
  lemma,
  consonants: lemma.normalize("NFKD").replace(/\p{M}/gu, ""),
  xlit,
  definition,
  kjv,
  value,
  // Strong's capitalises transliterations of names and places.
  // (ʼ aleph / ʻ ayin marks lead many common words — skip them before testing.)
  properName: ((c) => !!c && c !== c.toLowerCase())(xlit.replace(/^[ʼʻ'`]+/, "").charAt(0)),
  url: `https://biblehub.com/hebrew/${n}.htm`,
}));

const BY_VALUE = new Map<number, LexiconEntry[]>();
for (const e of ENTRIES) {
  const list = BY_VALUE.get(e.value) ?? [];
  list.push(e);
  BY_VALUE.set(e.value, list);
}

/**
 * Dictionary words whose letters total `value`. Common words first, names and
 * places after. Each match is recomputed here, so a stale data file can't
 * produce a false "exact match".
 */
export function wordsWithValue(value: number, limit = 12): LexiconEntry[] {
  const list = (BY_VALUE.get(value) ?? []).filter((e) => calculateGematria(e.lemma).total === value);
  // Same letters AND same sense (e.g. two "verily" entries) appear once;
  // same letters with different senses (ענוה meekness / humility) stay.
  const seen = new Set<string>();
  const key = (e: LexiconEntry) => `${e.consonants}|${(e.kjv || e.definition).replace(/[^a-z]/gi, "").slice(0, 12).toLowerCase()}`;
  return [...list.filter((e) => !e.properName), ...list.filter((e) => e.properName)]
    .filter((e) => (seen.has(key(e)) ? false : (seen.add(key(e)), true)))
    .slice(0, limit);
}

export function countWithValue(value: number): number {
  return BY_VALUE.get(value)?.length ?? 0;
}

/**
 * "Translate meaning": Hebrew dictionary words whose English definition uses
 * `english` as a whole word. Ranked: KJV rendering starts with it, then the
 * definition does, then anywhere. The caller lets the person pick the sense.
 */
export function searchEnglish(english: string, limit = 15): LexiconEntry[] {
  const w = english.trim().toLowerCase();
  if (!/^[a-z][a-z' -]{0,40}$/.test(w)) return [];
  const re = new RegExp(`\\b${w.replace(/[-']/g, "[-']?")}s?\\b`, "i");
  const scored: Array<{ e: LexiconEntry; s: number }> = [];
  for (const e of ENTRIES) {
    if (e.properName) continue;
    const kjv = e.kjv.toLowerCase();
    const def = e.definition.toLowerCase();
    let s = 0;
    if (new RegExp(`^${re.source}`, "i").test(kjv)) s = 4;
    else if (new RegExp(`^(a |an |the |to )?${re.source}`, "i").test(def)) s = 3;
    else if (re.test(kjv)) s = 2;
    else if (re.test(def)) s = 1;
    if (s) scored.push({ e, s });
  }
  return scored.sort((a, b) => b.s - a.s || a.e.consonants.length - b.e.consonants.length).slice(0, limit).map((x) => x.e);
}
