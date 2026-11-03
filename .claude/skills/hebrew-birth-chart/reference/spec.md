# NorthEDM: Astrology and Hebrew Numerology Calculator

**Implementation brief and reusable workflow**  
**Requested app label:** Astrology and Hebrew Numerology Calculator  
**Directory / hamburger-menu label:** Apps and Tools  
**Prepared:** November 2, 2026

**PDF format revision:** Include the complete reference charts described in
Section 10. Name meanings, numeric values, and number associations must appear
as connected tables in both the web result and the downloaded PDF.

## 1. Build objective

Add a reusable NorthEDM web app that accepts someone's name and birth details,
calculates their Hebrew birthday and Hebrew name values, explains sourced name
origins and traditional associations, and produces a downloadable PDF. Also
support translating words into Hebrew, writing names phonetically in Hebrew,
and looking up numbers and examples of Hebrew words with matching gematria.

Include a genuine Western astrology module when its calculation provider is
configured. The Hebrew calendar, Hebrew gematria, Jewish month symbolism, and
Western astrology are distinct systems. Present them as clearly labeled parts
of a report, with their methods and uncertainties visible.

This document specifies the feature to build. It does not claim that NorthEDM's
live navigation, database, or website has already been modified.

## 2. NorthEDM navigation and app directory

Create or extend a directory with these exact labels:

- Main navigation / hamburger menu: **Apps and Tools**.
- Directory card and calculator page title: **Astrology and Hebrew Numerology Calculator**.
- Suggested directory route: `/apps-and-tools`.
- Suggested calculator route: `/apps-and-tools/astrology-hebrew-numerology`.

Adapt these routes to the current repository if an established convention exists.
Use the existing navigation configuration so desktop and mobile entries agree.
Preserve the other menu items and existing authentication behavior.

Example directory configuration, to adapt to the site's actual types:

```ts
const astrologyHebrewNumerologyTool = {
  id: "astrology-hebrew-numerology",
  title: "Astrology and Hebrew Numerology Calculator",
  href: "/apps-and-tools/astrology-hebrew-numerology",
  description:
    "Explore birth charts, Hebrew birthdays, name meanings, and gematria. Create a PDF to keep or share.",
  category: "Astrology and Numerology",
};
```

Match NorthEDM's forest, Appalachian, and psychedelic visual identity with subtle
celestial accents. Favor legible forms and report tables over decorative effects.
Use the existing logo and the established tagline, **Unite the Northeast**.

## 3. App modes

### A. Birth Chart

Collect a person's details and produce a structured chart report containing:

1. Confirmed input details and any uncertainty.
2. Hebrew calendar date, Hebrew script, month, year, and weekday.
3. Historical meanings of each name component.
4. Selected Hebrew spelling of each name, letter values, and totals.
5. A few sourced traditional associations for the Hebrew date and name roots.
6. Western astrology results when a licensed, functioning ephemeris provider
   is configured and sufficient birth information is available.
7. Methods, sources, and a PDF preview/download.

### B. Words and Names

Offer three explicit conversion choices:

| Choice | What it does | Example |
| --- | --- | --- |
| Translate meaning | Finds the Hebrew word for a selected sense of the input | English noun "smoke" becomes עשן |
| Write the sound | Transliterates a name or phrase into Hebrew letters | A person's English name receives a phonetic Hebrew spelling |
| Analyze Hebrew | Calculates a supplied Hebrew spelling directly | חי receives the value 18 |

Show the Hebrew text, pronunciation/transliteration, meaning, source, individual
letters, and total. For ambiguous words, let the user choose the intended sense.
For names with multiple reasonable spellings, show the alternatives and let the
user select or edit the spelling before finalizing the report.

A phonetic spelling is not a translation of the name's historical meaning.
Do not silently replace a surname with a different Hebrew name that sounds alike.

### C. Number Lookup

Accept a nonnegative integer; support 0-9,999 in the first release, with validation
and a clear range message. Display:

- The number in Hebrew words, using a documented standalone grammatical form.
- Conventional Hebrew numeral notation when applicable.
- A small, curated set of sourced Hebrew words with the same gematria value.
- A clear indication that a number can have many matching words.

Keep **the number represented by a phrase** distinct from **the gematria of the
phrase's letters**. The phrase meaning "four hundred and twenty" does not have
to total 420. Hebrew numeral letters ת״כ do represent 400 + 20.

For example, עשן means smoke in general and totals 420. That numerical match
does not establish the historical origin of modern cannabis slang.

### D. Saved Reports

Let signed-in users list, reopen, rename, download, update, and delete their own
reports. Allow a guest to calculate and download without requiring an account;
ask them to sign in only when they choose to keep a report in NorthEDM.

## 4. Input fields

| Field | Requirement | Handling |
| --- | --- | --- |
| Full name | Needed for the name section | Preserve given, middle, surname, and suffix components |
| Preferred display name | Optional | Use on the report title if supplied |
| Gregorian birth date | Needed for the birthday section | ISO date internally; display an unambiguous date |
| Local birth time | Optional | Accept AM/PM or 24-hour entry and an explicit "Unknown" option |
| Time accuracy | Optional | Exact, approximate, or unknown; preserve a supplied uncertainty interval |
| Birthplace | Needed for time-sensitive calculations | City, region, country; retain a county-only description if that is all the source provides |
| Coordinates and IANA time zone | Derived and confirmed | Use the birthplace and historical date, not the viewer's current time zone |
| Name pronunciation | Optional | Ask when different pronunciations would change the spelling |
| Known family-name origin | Optional | Use this to choose between documented surname branches |
| Existing Hebrew spelling/name | Optional | Preserve a supplied spelling and calculate it transparently |
| Birth-certificate image | Optional | Extract the relevant fields, then let the user review them |

Do not require a birth certificate. For uploaded documents, extract only the
name, date, time, and birthplace needed for the chart. Do not reproduce record
numbers, signatures, addresses, or parents' information in the report by default.
Treat illegible or conflicting fields as uncertain and request correction.

## 5. Reusable calculation workflow

1. **Capture:** accept typed details, pasted text, or a certificate image.
2. **Review:** show the extracted fields and spelling choices for correction.
3. **Resolve location/time:** determine coordinates, historical IANA time zone,
   and the birth instant. Handle nonexistent or repeated DST clock times explicitly.
4. **Convert the calendar:** calculate the Hebrew date using the local evening
   boundary, and record whether the birth was before or after sunset.
5. **Analyze names:** research the applicable origin of each component and
   propose Hebrew phonetic spellings with pronunciation notes.
6. **Calculate gematria:** calculate exact letter values deterministically.
7. **Calculate astrology:** call a real ephemeris adapter when configured; record
   the zodiac and house-system choices alongside the results.
8. **Select associations:** retrieve a few relevant entries from a sourced
   content collection, labeling the tradition and uncertainty.
9. **Preview:** show the same structured result that will be exported.
10. **Export:** generate a PDF with selectable text, embedded Hebrew fonts,
    sources, and the displayed calculation settings.
11. **Save/download:** download immediately; save privately to the user's
    NorthEDM account when requested. Generate a new export version after edits.

A language model may help with explanations and spelling candidates. Calendar
conversion, time-zone resolution, ephemeris positions, and arithmetic must come
from deterministic, validated code or a verified calculation service.

## 6. Hebrew calendar rules

- A Hebrew date advances in the local evening, not at civil midnight.
- Use a documented sunset convention for the calculator. Flag a birth in the
  twilight interval when a more precise religious determination is uncertain.
- Check historical time-zone and daylight-saving rules for the birthplace.
- If birth time is unknown, show the daytime Hebrew date and the date after
  sunset as alternatives; do not select one as confirmed.
- If an approximate time interval crosses sunset, retain both possible dates.
- If the location has no calculable sunset on that date, return an uncertainty
  state rather than inventing a boundary.
- Preserve Hebrew leap-month distinctions, including Adar I and Adar II.
- Do not infer a holiday or observance solely because the Gregorian date looks
  similar to a Hebrew date.

Suggested MVP integration: Hebcal's documented date converter API. Determine
the local sunset condition before adding `gs=on`; the converter cannot infer
the birth location and time from a date alone.

```text
GET https://www.hebcal.com/converter?cfg=json&date=1996-12-27&g2h=1&strict=1
GET https://www.hebcal.com/converter?cfg=json&date=1996-12-27&g2h=1&strict=1&gs=on
```

Check package licenses before embedding a calendar library in the app. The
documented `Zmanim.makeSunsetAwareHDate` helper is another integration option
after validating its installed version and license.

## 7. Standard Hebrew gematria

Use **standard gematria** as the default and label it in the UI and PDF.

| Letters | Values |
| --- | --- |
| א ב ג ד ה ו ז ח ט | 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| י כ ל מ נ ס ע פ צ | 10, 20, 30, 40, 50, 60, 70, 80, 90 |
| ק ר ש ת | 100, 200, 300, 400 |
| ך ם ן ף ץ | 20, 40, 50, 80, 90 |

Normalize Hebrew presentation forms, ignore vowel/cantillation marks, spaces,
and punctuation, and preserve the underlying consonants. Reject unexpected
letters or digits instead of silently discarding them. Route numeric input to
Number Lookup. Do not mix English A-Z numerology with Hebrew gematria.

Reference TypeScript arithmetic implementation:

```ts
const LETTER_VALUES: Readonly<Record<string, number>> = Object.freeze({
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40,
  נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80,
  צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400,
});

export function calculateGematria(input: string) {
  const normalized = input.normalize("NFKD").replace(/\p{M}/gu, "");
  const letters: Array<{ letter: string; value: number }> = [];

  for (const letter of normalized) {
    const value = LETTER_VALUES[letter];
    if (value !== undefined) letters.push({ letter, value });
    else if (/[\p{P}\s]/u.test(letter)) continue;
    else throw new Error("Use Hebrew letters, or choose a conversion mode first.");
  }

  if (letters.length === 0) throw new Error("Enter at least one Hebrew letter.");

  return {
    method: "standard-hebrew-gematria",
    normalizedHebrew: letters.map(({ letter }) => letter).join(""),
    letters,
    total: letters.reduce((sum, { value }) => sum + value, 0),
  };
}
```

For generational suffixes, show a separate choice to exclude the suffix or
include its Hebrew ordinal wording. For example, V means "the fifth"; the
Hebrew word החמישי totals 373. Its letter total is a different quantity from
the ordinal number five. Show base-name and combined totals separately.

Additional methods, such as expanded final-letter values or reduced gematria,
belong behind an explicitly labeled future setting with their own definitions
and tests. Do not silently switch methods between reports.

## 8. Name meanings and traditional associations

Use a structured content record for each interpretation:

```ts
type Association = {
  id: string;
  title: string;
  tradition: "Jewish" | "Jewish Kabbalah" | "Christian occult history" |
             "Celtic etymology" | "Western astrology" | "Other";
  basis: "hebrew-day" | "hebrew-month" | "weekday" | "name-origin" |
         "word-value" | "astrological-placement";
  explanation: string;
  confidence: "well-attested" | "proposed" | "uncertain";
  sourceIds: string[];
};
```

Examples of the kinds of associations discussed in this conversation:

- חי / chai totals 18 and is associated with life.
- חיה / Chaya totals 23 and is a Hebrew name associated with life/living.
- Shabbat has a Kabbalistic association with Shekhinah, God's indwelling presence.
- Hebrew month symbolism may have a traditional zodiac correspondence.
- A surname can have multiple historical origins; a Welsh origin of Lewis
  points to the Llywelyn branch rather than automatically to Louis/Ludwig.
- Some reconstructed Celtic name origins involve deity names; label those
  derivations as historical proposals when disputed.
- Monthly angel lists in a medieval Christian text belong to that specific
  source and are not universal Jewish birthday rules.

If the user requests named entities, provide sourced historical/religious
context without assigning the person a guardian, hostile being, moral status,
or destiny. A shared value alone is not evidence of a personal relationship.
Do not fabricate a special meaning for every number, year, or complete name.

Keep the product note brief: **"Astrology and numerology are interpretive
traditions for reflection, not scientifically validated predictions."**

## 9. Western astrology module

Use a real ephemeris engine or licensed service. Suggested provider candidate:
Swiss Ephemeris, subject to its AGPL or professional-license requirements.
Choose and document an applicable license before operating a public service;
verify current terms rather than assuming the engine is unrestricted.

Define provider adapters so the core app is not tied to one vendor. Record:

- Exact UTC birth instant and location used.
- Tropical zodiac as the documented MVP default.
- Whole Sign as the documented MVP house-system default when birth time is known.
- Geocentric planetary positions and the ephemeris version/provider.
- Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, and Pluto.
- Ascendant, Midheaven, and houses only when a usable birth time/location exists.
- Any aspects with an explicit, versioned orb configuration.

Draw the chart wheel from computed longitudes as SVG. Use the same numeric
results for the wheel, tables, explanations, and PDF. Do not use generated
imagery or AI-written guesses as a substitute for calculated positions.

If time is unknown, calculate the date's local-day interval and show only
placements that remain valid throughout it; show changing signs as alternatives.
Omit Ascendant, Midheaven, and houses. Do not present an assumed noon time as a
confirmed birth time. If the provider is unconfigured, return a clear unavailable
state while still allowing Hebrew-date and numerology reports to work.

The Western Sun sign and a Hebrew month's traditional zodiac correspondence
must have separate labels and calculation bases.

## 10. Results and PDF requirements

### Mandatory reference charts

Every full report must include these actual tables. A list of numbers, separate
paragraphs about name origins, or narrative association bullets does not replace
the charts. The PDF must contain the same information the user can see on screen.

| Required chart | Columns and purpose |
| --- | --- |
| **1. Name meanings, Hebrew spellings and numbers** | Original name component; historical meaning and applicable family origin; exact Hebrew spelling; letter-value addends; component total; meaning-source references |
| **2. Number-to-association chart** | Number; the input/component that produced it; independently verified matching Hebrew word and pronunciation; that word's meaning or a documented numerical association; match type/status; source references |
| **3. Traditional figures and concepts** | Connection such as Hebrew month, weekday, or name origin; associated figure/concept; named tradition; explanation; source references |
| **Birth-timing comparison, when relevant** | Before/after-sunset condition; possible Hebrew date/day; corresponding Hebrew word/value; explicit identification of the confirmed case or remaining uncertainty |

Chart 1 must put the name meaning beside its spelling and number. For example,
a phonetic name value is not itself a translation of that name's etymology.
Chart 2 then supplies the separate number-to-word or number-to-symbol mapping.
Chart 3 keeps calendar and historical associations from being misrepresented
as numerical matches. A month-based angel-list entry must remain month-based.

Include one Chart 2 row for every name component, the base-name total, any
translated-suffix total, the combined total, and the Hebrew birthday day number.
Add meaning-root values as separate rows when discussed. A Hebrew year may be
listed as a calendar label without asserting an additional numerological meaning.
Letter addends and astronomical degrees do not each require interpretation rows.

If a word or symbolic association has not been verified, retain the number and
write **"No additional sourced association verified for this report."** Mark its
status accordingly. Do not drop that row or fabricate an interpretation.

Verify the exact consonant spelling of every matched Hebrew word against the
displayed value. Preserve articles, prefixes, final letters, and spelling variants:

- The prefix ה contributes 5; האמונה and אמונה have different totals.
- שלוה totals 341; the spelling שלווה totals 347. Do not remove a vav to force
  a match. Label the Biblical spelling if it is the form used by the source.
- A name's historical meaning, a same-value dictionary word, and a traditional
  figure association are separate relationships and require separate labels.
- An equal value does not make the matched word the meaning of the person's name.

Use shared structured arrays for the screen charts and PDF renderer, for example:

```ts
type NameMeaningChartRow = {
  componentId: string;
  originalName: string;
  historicalMeaning: string;
  familyOrigin?: string;
  hebrewSpelling: string;
  letters: Array<{ letter: string; value: number }>;
  value: number;
  sourceIds: string[];
};

type NumberAssociationChartRow = {
  value: number;
  fromComponentIds: string[];
  originLabel: string;
  matchedHebrew?: string;
  pronunciation?: string;
  meaningOrAssociation: string;
  kind: "exact-word-value" | "traditional-number-symbolism" |
        "translated-word-value" | "arithmetic-only" | "calendar-label" |
        "not-verified";
  spellingNote?: string;
  sourceIds: string[];
};

type ContextAssociationChartRow = {
  connection: string;
  figureOrConcept: string;
  tradition: string;
  explanation: string;
  relationship: "calendar-context" | "name-etymology" | "religious-concept";
  sourceIds: string[];
};
```

Repeat table headers across page breaks and wrap all cells within the page.
Retain Hebrew text, English meanings, numbers, association status, and citations
in the PDF as selectable text. Permit additional pages for these complete charts.

### Results, export and presentation

Use a mobile-friendly result view with a concise overview and expandable
sections: Birth Details, Hebrew Birthday, Name Meanings, Gematria, Astrology,
Traditional Associations, and Sources.

Provide these actions:

- **Edit details**
- **Preview PDF**
- **Download PDF**
- **Save report**
- **Share PDF**, using the device's file-sharing feature when supported

Generate PDFs from a structured, versioned calculation result. Target 2-4
readable pages; use more pages rather than shrinking text excessively.

Include NorthEDM branding, the person's chosen display name, birth details,
Hebrew dates, input uncertainty, selected spellings, per-letter arithmetic,
name-component totals, astrology settings/results, attributed interpretations,
clickable sources, report date, and page numbers. Permit a word-only PDF when
the user used Words and Names or Number Lookup.

Embed a licensed Hebrew-capable font. Render actual right-to-left text with
direction isolation for Hebrew spans. Wait for fonts to load before export.
Keep Hebrew and numeric text selectable and searchable. Ensure Hebrew letters,
vowel marks, punctuation, and mixed-direction tables render correctly.

Suggested web approach: an HTML/CSS report template rendered to PDF with
Playwright in a compatible server worker. Verify deployment support for a
browser binary or choose a suitable PDF provider. Browser print is a useful
fallback, not the only export path. Keep external API keys on the server.

Export a sanitized filename such as
`NorthEDM_<display-name>_Astrology_Hebrew_Numerology.pdf`.

## 11. Proposed application architecture

Use the site's current framework and authentication setup. NorthEDM has been
described as Next.js plus Supabase; inspect the actual repository before
changing routing, migrations, dependencies, or shared navigation.

Suggested separation of responsibilities:

| Component | Responsibility |
| --- | --- |
| Input UI | Birth details, word/number modes, spelling selection, review |
| Place/time adapter | Geocoding, historical time-zone resolution, ambiguity |
| Hebrew calendar adapter | Sunset-aware calendar conversion and provenance |
| Hebrew language adapter | Translation senses and phonetic spelling candidates |
| Gematria module | Pure normalization, letter breakdown, arithmetic |
| Astrology adapter | Ephemeris positions, houses, aspects, provider metadata |
| Interpretation collection | Curated, sourced, tradition-labeled explanations |
| Report assembler | Stable result JSON and input/calculation provenance |
| PDF worker | Embedded-font PDF creation from the same result JSON |
| Report persistence | Private saved results and PDF versions |

Proposed endpoints, to adapt to the existing API conventions:

```text
POST /api/apps-tools/astrology-hebrew/resolve-place
POST /api/apps-tools/astrology-hebrew/extract-birth-details
POST /api/apps-tools/astrology-hebrew/convert-text
POST /api/apps-tools/astrology-hebrew/calculate
POST /api/apps-tools/astrology-hebrew/reports
GET  /api/apps-tools/astrology-hebrew/reports
GET  /api/apps-tools/astrology-hebrew/reports/:id
POST /api/apps-tools/astrology-hebrew/reports/:id/pdf
GET  /api/apps-tools/astrology-hebrew/exports/:id
DELETE /api/apps-tools/astrology-hebrew/reports/:id
```

For guest exports, support a short-lived job/download token without requiring a
saved account report. For long-running work, return an actual job ID/status and
allow retry after failure. Never display a successful save or PDF until it exists.

Store a schema version, calculation method, source references, selected spelling,
time-zone decision, provider/version, uncertainty, and generated timestamp in
every result. Explanations should reference calculated facts by ID, not rewrite
the underlying numbers.

## 12. Private saved-report library

NorthEDM's **Saved Reports** is an app feature backed by its own database/storage.
It is separate from the native ChatGPT Library used to save deliverables in this
conversation. Do not assume an undocumented public API can write to a user's
ChatGPT Library from the website.

Suggested Supabase entities:

| Table | Minimum fields |
| --- | --- |
| `app_tool_reports` | `id`, `owner_id`, `tool_slug`, `title`, `mode`, `input_json`, `result_json`, `schema_version`, `created_at`, `updated_at` |
| `app_tool_report_exports` | `id`, `report_id`, `version`, `status`, `storage_path`, `sha256`, `created_at` |

Use a private report bucket and row-level security on database rows and storage
objects. Derive ownership from the authenticated user on the server. Verify
ownership for read, update, delete, export, and signed-download actions.
Use opaque object paths such as `<owner-id>/<report-id>/<export-id>.pdf`.

Keep private PDFs downloadable through authenticated requests or short-lived
signed URLs. A signed URL is usable by anyone holding it until it expires;
generate it only after authorization and do not treat it as a permanent public
share. Do not make private reports publicly searchable or indexable.

Do not retain original certificate images by default. If image retention is
added later, make it an explicit user choice with a deletion path. Do not log
birth documents, full form payloads, or secrets in analytics. Rate-limit costly
language, geocoding, and PDF requests. Validate inputs and escape all text
rendered into HTML, SVG, or PDF templates.

## 13. Verification and acceptance criteria

### Arithmetic fixtures

| Hebrew input | Expected standard value |
| --- | ---: |
| אב | 3 |
| אהבה | 13 |
| טוב | 17 |
| חי | 18 |
| חיה | 23 |
| אדם | 45 |
| אדנים | 105 |
| האמונה | 107 |
| אחרי | 219 |
| מרום | 286 |
| שלוה | 341 |
| שלווה | 347 |
| אשף | 381 |
| עשן | 420 |
| עָשָׁן | 420 |
| החמישי | 373 |
| השבת | 707 |

Test spaces, punctuation, vowel marks, Hebrew presentation forms, every final
letter, empty input, unsupported scripts, and embedded markup. The letter
breakdown must always sum to the displayed total.

### Calendar fixtures

- December 27, 1996 during local daytime: 17 Tevet 5757.
- December 27, 1996 well after sunset in Berwick, Pennsylvania: 18 Tevet 5757.
- August 15, 1998 at 8:09 AM in Schuylkill County, Pennsylvania: 23 Av 5758.
- Unknown birth time: retain both daytime/after-sunset options.
- Test leap years, Adar I/II, DST gaps/folds, dates crossing UTC midnight,
  sunset-adjacent uncertainty, and locations without a calculable sunset.

### Functional acceptance

1. The Apps and Tools menu opens the directory on desktop and mobile.
2. The card and page use the exact requested calculator label.
3. A typed input and a reviewed certificate extraction produce equivalent results.
4. Editing a Hebrew spelling recalculates letter values and the report total.
5. Every historical/religious interpretation identifies its source and tradition.
6. Ephemeris output is checked against a trusted reference with identical
   settings; tolerances are documented per output type. No fabricated placements.
7. Unknown time suppresses unsupported astrology results and labels date ambiguity.
8. All PDF pages render legibly, including Hebrew and mixed-direction content.
9. Screen results and PDF arithmetic/settings agree exactly.
10. Guests can download; authenticated users can save and reopen their own reports.
11. A second account cannot read or export the first account's reports.
12. Provider failure preserves entered fields and offers a recoverable state.
13. All four reference-chart types required by Section 10 are exported when
    applicable, including the complete name-meaning and number-association columns.
14. The set of component/total/day numbers in Chart 2 covers the report's
    numerology values; unmapped values have explicit status rows.
15. Every claimed exact-word match recalculates to its row's number, including
    prefixed forms and orthography variants. A failed equality blocks that match.
16. Preview-to-PDF verification confirms that no table, meaning, match, status,
    or source column was lost or replaced by a narrative-only summary.

## 14. Implementation order

1. Inspect the current NorthEDM app and identify shared navigation/auth/report patterns.
2. Add the Apps and Tools directory and calculator entry.
3. Implement input review, Hebrew date conversion, and deterministic gematria.
4. Add name-origin and translation/transliteration workflows with sources.
5. Add sourced associations and the HTML/PDF report template.
6. Add private saved reports and export versioning.
7. Connect and verify the licensed Western astrology adapter.
8. Complete the acceptance checks before enabling the finished app publicly.

Build complete working flows. Mark an unconfigured module unavailable rather
than filling it with sample results that look personal or calculated.

## 15. Ready-to-paste implementation prompt

> Implement the NorthEDM feature described in this file. Add an Apps and Tools
> directory and a hamburger-menu entry using that exact label. Include the app
> Astrology and Hebrew Numerology Calculator. Support birth details or reviewed
> certificate extraction, sunset-aware Hebrew birthdays, historical name meanings,
> selectable Hebrew transliterations, deterministic gematria, Hebrew word and
> number conversion, sourced traditional associations, a real configured astrology
> engine, and downloadable PDFs. Reuse the site's existing Next.js/Supabase patterns
> after inspecting the repository. Save account reports privately, keep sources
> and uncertainty visible, and meet the acceptance criteria in this document.
> Export the mandatory name-meaning/value, number-association, context-association,
> and applicable birth-timing charts from Section 10 in full. Keep a clear status
> row for any number without a verified association. Do not substitute a shortened
> numeric table or separate prose for these charts.
> Do not deploy unfinished modules or invent chart positions, name meanings,
> guardian beings, or numerical matches.

## 16. Source and integration references

Official technical references, checked while preparing this brief:

- [Hebcal developer APIs](https://www.hebcal.com/home/developer-apis)
- [Hebcal date converter API, including after-sunset parameter](https://www.hebcal.com/home/219/hebrew-date-converter-rest-api)
- [Hebcal sunset-aware Hebrew-date helper](https://hebcal.github.io/api/core/classes/Zmanim.html#makeSunsetAwareHDate)
- [Swiss Ephemeris documentation and licensing](https://www.astro.com/swisseph/swisseph.htm)
- [Official Swiss Ephemeris source](https://github.com/aloistr/swisseph)
- [Supabase private/public storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Playwright PDF generation](https://playwright.dev/docs/api/class-page#page-pdf)

Examples of the cultural/language sources used in the conversation:

- [Gematria method and interpretive limits](https://www.chabad.org/library/article_cdo/aid/6664656/jewish/Gematria-FAQ.htm)
- [Chai and the value 18](https://www.chabad.org/library/article_cdo/aid/484894/jewish/What-is-the-reason-giving-money-in-multiples-of-18.htm)
- [Chaya: Hebrew spelling and meaning](https://reformjudaism.org/baby-names/chaya)
- [Shabbat, Shekhinah, and bride/queen imagery](https://www.chabad.org/library/article_cdo/aid/3753326/jewish/Four-Reasons-Shabbat-Is-Compared-to-Bride-and-a-Queen.htm)
- [Llywellyn: scholarly name-history entry](https://dmnes.org/name/Llywellyn)
- [The Sworn Book of Honorius: historical month/angel lists](https://esotericarchives.com/juratus/juratus.htm)
- [BDB / Strong H825: אשף, enchanter/conjurer](https://biblehub.com/hebrew/825.htm)
- [Hebrew dictionary: אחרי, after/behind](https://en.wiktionary.org/wiki/%D7%90%D7%97%D7%A8%D7%99)
- [BDB / Strong H530: אמונה, faith/faithfulness](https://biblehub.com/hebrew/530.htm)
- [Jeremiah 7:28: the prefixed form האמונה](https://www.openbible.com/text/jeremiah/7-28.htm)
- [BDB / Strong H4791: מרום, height](https://biblehub.com/hebrew/4791.htm)
- [BDB / Strong H7962: שלוה, quietness/ease](https://biblehub.com/hebrew/7962.htm)
- [Strong H134: plural אדנים, bases/sockets](https://kjvstudy.org/strongs/H134)

Pin implementation dependencies and record their versions. Recheck provider
documentation, licensing, and terms when implementing or updating the live app.
