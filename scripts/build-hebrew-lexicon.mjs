// Rebuild utils/numerology/data/strongs-hebrew.json from Open Scriptures' Strong's
// Hebrew dictionary (CC BY-SA), downloaded from
// https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js
// Usage: node scripts/build-hebrew-lexicon.mjs <that file> utils/numerology/data/strongs-hebrew.json
import { readFileSync, writeFileSync } from "node:fs";
import { gematriaOrNull } from "../utils/numerology/gematria.ts";
const src = readFileSync(process.argv[2], "utf8");
const d = JSON.parse(src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1));
const clip = (s = "", n) => { s = s.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/[ ,;]+\S*$/, "") + "…" : s; };
const rows = [];
for (const [id, e] of Object.entries(d)) {
  const v = gematriaOrNull(e.lemma || "");
  if (v == null) continue;
  rows.push([Number(id.slice(1)), e.lemma, e.xlit || "", clip(e.strongs_def, 140), clip(e.kjv_def, 90), v]);
}
rows.sort((a, b) => a[0] - b[0]);
writeFileSync(process.argv[3], JSON.stringify({
  source: "Open Scriptures Strong's Hebrew Dictionary (github.com/openscriptures/strongs), CC BY-SA. Definitions shortened; value = standard gematria of the lemma's consonants.",
  fields: ["strongs", "lemma", "xlit", "definition", "kjv", "value"],
  rows,
}));
console.log(rows.length, "entries");
