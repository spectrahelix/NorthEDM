---
name: hebrew-birth-chart
description: Make a Hebrew Birth & Name Chart PDF (Hebrew birthday, name meanings, Hebrew spellings, gematria, number-to-word associations, traditional figures, sources) for a person, or answer a gematria / Hebrew-number question. Use when asked for a birth chart, Hebrew name chart, gematria value, Hebrew birthday, or the "Astrology and Hebrew Numerology Calculator".
---

# Hebrew Birth & Name Chart

The full product brief is `reference/spec.md` (the owner's document, 2026-11-02).
A finished, verified example is `examples/charles-jackson-lewis-v.json` → run it
through the renderer to see the expected PDF. Book-derived methods, once added,
live in `reference/book-notes.md`.

## Tools (deterministic — never do arithmetic in your head)

```bash
node .claude/skills/hebrew-birth-chart/scripts/gematria.mjs --test        # fixtures, must pass
node .claude/skills/hebrew-birth-chart/scripts/gematria.mjs "צ׳ארלס"     # letters, addends, total
node .claude/skills/hebrew-birth-chart/scripts/render-chart.mjs report.json out.pdf
```

`render-chart.mjs` recomputes every Hebrew spelling and every matched word, checks
that Chart 2 has a row for each component, the base total, the combined total and
the birth day, and that every cited source id exists. **It refuses to render on any
mismatch** — fix the data, never the check. It writes the HTML preview next to the PDF.
Put outputs in the scratchpad, not the repo; send the PDF with SendUserFile.

## Workflow

1. **Capture** name (given / middle / surname / suffix), Gregorian date, local time
   + accuracy, birthplace. From a birth certificate take only those fields — no
   record numbers, signatures, addresses or parents.
2. **Hebrew date.** Find local sunset for that place and date (historical time zone
   and DST). Before sunset → `g2h` as-is; after → add `gs=on`:
   `https://www.hebcal.com/converter?cfg=json&date=YYYY-MM-DD&g2h=1&strict=1[&gs=on]`.
   Unknown time, or an interval crossing sunset → keep **both** dates as rows in the
   timing chart; confirm neither. Keep Adar I / Adar II distinct.
3. **Name meanings.** Research each component's real etymology with a source. For
   surnames with several origins, use the family's known origin (ask if unknown).
4. **Hebrew spellings.** Phonetic spelling (צ׳ for "ch", ג׳ for "j"; geresh has no
   value). Offer alternatives when spelling is ambiguous. A generational suffix is
   *translated* (V → החמישי, 373), shown separately: base, suffix, combined.
5. **Gematria** via the script only. Standard method; finals keep ordinary values.
6. **Number-to-association rows** (Chart 2): one per component value, base total,
   suffix, combined, and the Hebrew birth day. A matched word must recompute to the
   same number with its exact spelling (prefix ה counts 5; שלוה 341 ≠ שלווה 347).
   No verified match → keep the row, write "No additional sourced association
   verified for this report." Hebrew year = calendar label only.
7. **Traditional figures** (Chart 3): weekday, month, name-origin connections, each
   with its named tradition and source. Month-based lists stay month-based.
8. **Astrology:** from `utils/numerology/astrology.ts` (Astronomy Engine, checked
   against NASA). Unknown time → no Ascendant/houses/aspects; never assume noon.
9. Write the report JSON (same shape as the example), render, read the PDF pages
   back to check layout, send it.

## Hard rules

- An equal value is a coincidence of letters, not the meaning of the name, and
  never a guardian, hostile being, moral status or destiny.
- Every interpretation names its tradition and a source. No source → don't assert it.
- Don't mix English A–Z numerology with Hebrew gematria.
- Keep the note: *Astrology and numerology are interpretive traditions for
  reflection, not scientifically validated predictions.*
- Book material: summarize methods in your own words with a citation; don't paste
  copyrighted passages into the repo or into reports.

## The live tool on the site

`/apps-and-tools/astrology-hebrew-numerology` (menu: **Apps and Tools**) does all of
this for anyone, with PDF download via the browser's print-to-PDF. The calculation
code is shared — use it here instead of re-deriving anything:

- `utils/numerology/gematria.ts` — values, Hebrew numerals, number words (this skill's
  `scripts/gematria.mjs` is a CLI over it)
- `utils/numerology/hebrewCalendar.ts` — offline Hebrew dates + fixed holidays
- `utils/numerology/birthTiming.ts` — time zones (DST gaps/folds), sunset, the date decision
- `utils/numerology/astrology.ts` — Astronomy Engine positions, Ascendant/MC, Whole Sign, aspects.
  **Astrology is now available**: use it rather than marking it unavailable.
- `utils/numerology/lexicon.ts` — same-value Hebrew words from Strong's (CC BY-SA)
- `utils/numerology/report.ts` — `buildReport()` produces the report JSON

Quick report from Node (run in the repo root):

```bash
node --no-warnings -e 'import("./utils/numerology/report.ts").then(r => console.log(JSON.stringify(r.buildReport({
  components: [{ original: "Alec", role: "given", hebrew: "אלק" }],
  date: "2002-07-24", time: "13:00", timeAccuracy: "exact",
  place: { label: "Hazleton, PA", lat: 40.9549, lon: -75.977, zone: "America/New_York" } }), null, 2)))'
```

Tests: `npm run test:astro-hebrew` (offline) and `-- --live` (re-asks Hebcal and NASA JPL Horizons).
Saved reports in accounts are not built yet (spec §12).
