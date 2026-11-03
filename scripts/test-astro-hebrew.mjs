#!/usr/bin/env node
// Tests for the Astrology and Hebrew Numerology Calculator (utils/numerology).
// Every check here can fail: each compares our code against an outside
// reference or an independent computation, not against itself.
//
//   npm run test:astro-hebrew            offline checks (stored references)
//   npm run test:astro-hebrew -- --live  also re-ask Hebcal and NASA JPL Horizons
//
// References stored below were fetched on 2026-11-03 from
//   NASA JPL Horizons (ssd.jpl.nasa.gov) — apparent geocentric ecliptic longitude, quantity 31
//   sunrise-sunset.org — sunset times
// and Hebcal's converter API is queried live with --live.

import * as Astronomy from "astronomy-engine";
import { calculateGematria, hebrewNumeral, hebrewNumberWords } from "../utils/numerology/gematria.ts";
import { hebrewFromIso, observancesOn, isoFromRd, rdFromIso } from "../utils/numerology/hebrewCalendar.ts";
import { resolveWallTime, sunsetFor } from "../utils/numerology/birthTiming.ts";
import { eclipticLongitude, anglesAt, calculateAstrology } from "../utils/numerology/astrology.ts";
import { buildReport } from "../utils/numerology/report.ts";
import { wordsWithValue, searchEnglish } from "../utils/numerology/lexicon.ts";

const LIVE = process.argv.includes("--live");
let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log("FAIL", msg); } };
const section = (s) => console.log(`\n— ${s}`);
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// ---------------------------------------------------------------- gematria
section("gematria");
const GEM = [
  ["אב", 3], ["אהבה", 13], ["טוב", 17], ["חי", 18], ["חיה", 23], ["אדם", 45], ["אדנים", 105],
  ["האמונה", 107], ["אחרי", 219], ["מרום", 286], ["שלוה", 341], ["שלווה", 347], ["אשף", 381],
  ["עשן", 420], ["עָשָׁן", 420], ["החמישי", 373], ["השבת", 707], ["צ׳ארלס", 381], ["ךםןףץ", 280], ["שׁ", 300],
];
for (const [w, v] of GEM) {
  const g = calculateGematria(w);
  ok(g.total === v && g.letters.reduce((s, l) => s + l.value, 0) === g.total, `${w} = ${g.total}, expected ${v}`);
}
for (const bad of ["", "abc", "חי5", "<b>חי</b>"]) {
  let threw = false; try { calculateGematria(bad); } catch { threw = true; }
  ok(threw, `should reject ${JSON.stringify(bad)}`);
}
ok(hebrewNumeral(15) === "ט״ו" && hebrewNumeral(16) === "ט״ז" && hebrewNumeral(420) === "ת״כ" && hebrewNumeral(5757) === "ה׳תשנ״ז", "Hebrew numerals");
ok(hebrewNumberWords(420) === "ארבע מאות ועשרים", "420 in words");
// The number a phrase names ≠ the gematria of its letters (spec §3C).
ok(calculateGematria(hebrewNumberWords(420)).total !== 420, "words for 420 should not total 420");

// ---------------------------------------------------------------- calendar
section("Hebrew calendar");
const CAL = [
  ["1996-12-27", "17 Tevet 5757"], ["1996-12-28", "18 Tevet 5757"], ["1998-08-15", "23 Av 5758"],
  ["2002-07-24", "15 Av 5762"], ["2024-03-01", "21 Adar I 5784"], ["2024-03-25", "15 Adar II 5784"],
  ["2023-09-16", "1 Tishrei 5784"], ["1800-01-01", "4 Tevet 5560"],
];
for (const [iso, want] of CAL) ok(hebrewFromIso(iso).label === want, `${iso} → ${hebrewFromIso(iso).label}, expected ${want}`);

if (LIVE) {
  const NAMES = ["Rosh Hashana", "Yom Kippur", "Sukkot", "Shmini Atzeret", "Simchat Torah", "Chanukah", "Tu BiShvat",
    "Shushan Purim", "Purim", "Pesach", "Lag BaOmer", "Shavuot", "Tish'a B'Av", "Tu B'Av"];
  const canon = (raw) => {
    const e = raw.replace(/[\u2018\u2019]/g, "'"); // Hebcal writes Tu B’Av
    if (/Erev|Katan|LaBehemot|Sheni|1 Candle|Purim Meshulash/.test(e)) return null;
    return NAMES.find((n) => e.startsWith(n)) ?? null;
  };
  let days = 0, eventsChecked = 0;
  for (const start of ["1800-03-01", "1850-08-01", "1900-01-01", "1950-09-01", "1996-10-01", "2002-06-01",
    "2024-01-01", "2024-07-01", "2050-02-01", "2100-08-01", "2150-03-01", "2199-06-01"]) {
    const end = isoFromRd(rdFromIso(start) + 179);
    const res = await fetch(`https://www.hebcal.com/converter?cfg=json&start=${start}&end=${end}&g2h=1`);
    const { hdates } = await res.json();
    for (const [iso, h] of Object.entries(hdates)) {
      days++;
      const mine = hebrewFromIso(iso);
      ok(mine.year === h.hy && mine.monthName === h.hm && mine.day === h.hd, `${iso}: ours ${mine.label}, Hebcal ${h.hd} ${h.hm} ${h.hy}`);
      const theirs = new Set((h.events ?? []).map(canon).filter(Boolean));
      const ours = new Set(observancesOn(mine));
      for (const n of NAMES) {
        if (theirs.has(n) !== ours.has(n)) ok(false, `${iso} ${mine.label}: ${n} — Hebcal ${theirs.has(n)}, ours ${ours.has(n)}`);
        else if (ours.has(n)) eventsChecked++;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`  compared ${days} days and ${eventsChecked} holiday days with Hebcal`);
}

// ---------------------------------------------------------------- time zones and sunset
section("time zones and sunset");
const NY = "America/New_York";
ok(resolveWallTime("2021-03-14", "02:30", NY).kind === "gap", "2:30 AM on DST start should not exist");
const fold = resolveWallTime("2021-11-07", "01:30", NY);
ok(fold.kind === "fold" && fold.candidates[1].utcMs - fold.candidates[0].utcMs === 3600000, "1:30 AM on DST end should happen twice, an hour apart");
ok(resolveWallTime("2002-07-24", "13:00", NY).kind === "ok" && resolveWallTime("2002-07-24", "13:00", NY).offsetMinutes === -240, "EDT offset");
ok(resolveWallTime("1996-12-27", "23:58", NY).offsetMinutes === -300, "EST offset");
// sunrise-sunset.org: Hazleton 2002-07-24 sunset 00:28:15Z; Berwick 1996-12-27 sunset 21:43:29Z
const SUNSETS = [
  ["2002-07-24", 40.9584, -75.9746, Date.parse("2002-07-25T00:28:15Z")],
  ["1996-12-27", 41.0542, -76.2333, Date.parse("1996-12-27T21:43:29Z")],
];
for (const [iso, lat, lon, ref] of SUNSETS) {
  const s = sunsetFor(iso, lat, lon, NY);
  ok(s.kind === "ok" && Math.abs(s.sunsetUtcMs - ref) < 120000, `sunset ${iso} off by ${s.kind === "ok" ? Math.round((s.sunsetUtcMs - ref) / 1000) : "?"}s`);
}
ok(sunsetFor("2002-06-21", 78.22, 15.65, "Arctic/Longyearbyen").kind === "none", "midnight sun should have no sunset");

// ---------------------------------------------------------------- planets vs NASA JPL Horizons
section("planets vs NASA JPL Horizons");
const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const HORIZONS_IDS = ["10", "301", "199", "299", "499", "599", "699", "799", "899", "999"];
const JPL = {
  "2002-07-24T17:00:00Z": [121.6210515, 305.4913415, 125.7816574, 165.3752502, 127.0995442, 118.2177630, 84.0688212, 327.8567273, 309.8090944, 255.1758042],
  "1996-12-28T04:58:00Z": [276.7422577, 133.8488700, 287.3728164, 253.7034084, 177.9283785, 294.2963579, 1.1575114, 303.0621387, 296.6901811, 244.2566552],
  "1950-03-15T06:30:00Z": [354.1095118, 315.4612158, 342.4842065, 311.5405149, 185.0499504, 323.6238296, 165.4108745, 90.9510068, 196.5800677, 136.1912166],
  "2031-10-02T21:15:00Z": [189.4805057, 35.9818150, 196.2521298, 144.6212286, 264.6449902, 262.4749712, 83.0216384, 87.2647022, 14.3375609, 311.3747336],
};
async function horizons(id, iso) {
  const t = iso.slice(0, 16).replace("T", " ");
  const q = new URLSearchParams({ format: "text", COMMAND: `'${id}'`, CENTER: "'500@399'", EPHEM_TYPE: "OBSERVER", START_TIME: `'${t}'`, STOP_TIME: `'${t}:30'`, STEP_SIZE: "'1 m'", QUANTITIES: "'31'", OBJ_DATA: "NO" });
  for (let attempt = 1; ; attempt++) {
    await new Promise((r) => setTimeout(r, 400 * attempt)); // be gentle with NASA's service
    const txt = await (await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${q}`)).text();
    const body = txt.split("$$SOE")[1];
    if (body) return Number(body.trim().split("\n")[0].trim().split(/\s+/)[2]);
    if (attempt >= 4) throw new Error(`Horizons gave no data for ${id} at ${iso}: ${txt.slice(0, 300)}`);
  }
}
const TOL = 0.01; // degrees (36″); Astronomy Engine documents ±1′ accuracy
let worst = 0;
for (const [iso, refs] of Object.entries(JPL)) {
  for (let i = 0; i < BODIES.length; i++) {
    const ref = LIVE ? await horizons(HORIZONS_IDS[i], iso) : refs[i];
    const d = angDiff(eclipticLongitude(BODIES[i], Date.parse(iso)), ref);
    worst = Math.max(worst, d);
    ok(d < TOL, `${BODIES[i]} at ${iso}: off by ${(d * 3600).toFixed(1)}″`);
  }
}
console.log(`  worst difference: ${(worst * 3600).toFixed(1)}″ (limit ${TOL * 3600}″)`);

// ---------------------------------------------------------------- Ascendant / Midheaven vs a direct sky search
// Independent of the formulas: walk the ecliptic of date, turn each point into
// local horizon coordinates, and find where it crosses the eastern horizon
// (Ascendant) and the meridian above the horizon (Midheaven).
section("Ascendant and Midheaven vs sky search");
function skySearch(ms, lat, lon) {
  const time = Astronomy.MakeTime(new Date(ms));
  const obs = new Astronomy.Observer(lat, lon, 0);
  const rot = Astronomy.CombineRotation(Astronomy.Rotation_ECT_EQD(time), Astronomy.Rotation_EQD_HOR(time, obs));
  const hor = (L) => Astronomy.RotateVector(rot, Astronomy.VectorFromSphere(new Astronomy.Spherical(0, L, 1), time));
  const refine = (f, a, b) => { for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (Math.sign(f(m)) === Math.sign(f(a))) a = m; else b = m; } return (a + b) / 2; };
  let asc = null, mc = null, mcZ = -2;
  const step = 0.25;
  for (let L = 0; L < 360; L += step) {
    const v0 = hor(L), v1 = hor(L + step);
    // Horizon frame: x north, y west, z zenith. Along the ecliptic at one
    // instant, points past the Ascendant are still below the eastern horizon
    // (they rise later), so the Ascendant is where z goes + → − on the east side.
    if (v0.z >= 0 && v1.z < 0 && v0.y < 0) asc = refine((x) => hor(x).z, L, L + step);
    if (Math.sign(v0.y) !== Math.sign(v1.y)) {
      const m = refine((x) => hor(x).y, L, L + step);
      if (hor(m).z > mcZ) { mcZ = hor(m).z; mc = m; }
    }
  }
  return { asc: asc % 360, mc: mc % 360 };
}
const PLACES = [
  ["2002-07-24T17:00:00Z", 40.9549, -75.977], // Alec, Hazleton
  ["1996-12-28T04:58:00Z", 41.0542, -76.2333], // Berwick, near midnight
  ["2031-10-02T21:15:00Z", -33.87, 151.21], // Sydney
  ["1950-03-15T06:30:00Z", 64.15, -21.94], // Reykjavik, near the limit
  ["2010-01-01T12:00:00Z", 0.35, 32.58], // Kampala, equator
];
for (const [iso, lat, lon] of PLACES) {
  const f = anglesAt(Date.parse(iso), lat, lon);
  const s = skySearch(Date.parse(iso), lat, lon);
  ok(angDiff(f.asc, s.asc) < 0.01, `Ascendant ${iso} (${lat},${lon}): formula ${f.asc.toFixed(3)} vs sky ${s.asc.toFixed(3)}`);
  ok(angDiff(f.mc, s.mc) < 0.01, `Midheaven ${iso} (${lat},${lon}): formula ${f.mc.toFixed(3)} vs sky ${s.mc.toFixed(3)}`);
}

// Unknown time hides time-dependent results.
const day0 = Date.parse("2002-07-24T04:00:00Z");
const unk = calculateAstrology({ window: [day0, day0 + 86400000 - 1], timeBasis: "unknown", lat: 40.95, lon: -75.97 });
ok(unk.ascendant === null && unk.houses === null && unk.aspects === null, "unknown time must omit Ascendant, houses, aspects");
ok(unk.placements.find((p) => p.body === "Moon").possibleSigns.length === 2, "Moon changed sign that day; both signs expected");

// ---------------------------------------------------------------- report invariants
section("report");
const alec = buildReport({
  components: [
    { original: "Alec", role: "given", hebrew: "אלק" },
    { original: "Christopher", role: "middle", hebrew: "כריסטופר" },
    { original: "Burkos", role: "surname", hebrew: "בורקוס" },
  ],
  date: "2002-07-24", time: "13:00", timeAccuracy: "exact",
  place: { label: "Hazleton, PA", lat: 40.9549, lon: -75.977, zone: NY },
});
ok(alec.hebrewDate.label === "15 Av 5762" && alec.hebrewDate.status === "confirmed", "Alec: 15 Av 5762 confirmed");
ok(alec.totals.base === 1090, "Alec: 1090");
const charles = buildReport({
  components: [
    { original: "Charles", role: "given", hebrew: "צ׳ארלס" }, { original: "Jackson", role: "middle", hebrew: "ג׳קסון" },
    { original: "Lewis", role: "surname", hebrew: "לואיס" }, { original: "V", role: "suffix", hebrew: "החמישי" },
  ],
  date: "1996-12-27", time: "23:58", timeAccuracy: "exact",
  place: { label: "Berwick, PA", lat: 41.0542, lon: -76.2333, zone: NY },
});
ok(charles.hebrewDate.label === "18 Tevet 5757" && charles.totals.base === 707 && charles.totals.combined === 1080, "Charles: 18 Tevet, 707 / 1080");
const unknown = buildReport({
  components: [{ original: "Charles", role: "given", hebrew: "צ׳ארלס" }],
  date: "1996-12-27", time: null, timeAccuracy: "unknown",
  place: { label: "Berwick, PA", lat: 41.0542, lon: -76.2333, zone: NY },
});
ok(unknown.hebrewDate.status === "uncertain" && unknown.timingChart.length === 2 && unknown.timingChart.every((t) => !t.confirmed), "unknown time keeps both dates, confirms neither");

for (const r of [alec, charles, unknown]) {
  const ids = new Set(r.sources.map((s) => s.id));
  for (const n of r.nameChart) ok(n.letters.reduce((s, l) => s + l.value, 0) === n.value, `${r.displayName}: ${n.originalName} addends`);
  for (const row of r.numberChart) {
    if (row.kind === "exact-word-value") ok(calculateGematria(row.matchedHebrew).total === row.value, `${r.displayName}: ${row.matchedHebrew} ≠ ${row.value}`);
    if (!row.matchedHebrew && row.kind !== "calendar-label") ok(/No additional sourced association/.test(row.meaningOrAssociation), `${r.displayName}: row ${row.value} needs explicit status`);
    for (const id of row.sourceIds) ok(ids.has(id), `${r.displayName}: missing source ${id}`);
  }
  for (const c of r.contextChart) for (const id of c.sourceIds) ok(ids.has(id), `${r.displayName}: missing source ${id}`);
  const have = new Set(r.numberChart.map((n) => n.value));
  const need = [...r.nameChart.map((n) => n.value), r.totals.base, ...(r.totals.suffix ? [r.totals.combined] : []), ...r.timingChart.filter((t) => t.confirmed).map((t) => t.value)];
  for (const v of need) ok(have.has(v), `${r.displayName}: chart 2 lacks ${v}`);
}
let gapRejected = false;
try {
  buildReport({ components: [{ original: "A", role: "given", hebrew: "א" }], date: "2021-03-14", time: "02:30", timeAccuracy: "exact", place: { label: "NY", lat: 40.7, lon: -74, zone: NY } });
} catch (e) { gapRejected = /didn't happen/.test(e.message); }
ok(gapRejected, "a clock time skipped by DST must be refused, not guessed");

// ---------------------------------------------------------------- lexicon
section("lexicon");
for (const v of [131, 374, 420, 585, 707]) for (const w of wordsWithValue(v, 50)) ok(calculateGematria(w.lemma).total === v, `lexicon ${w.strongs} ${w.consonants} ≠ ${v}`);
ok(searchEnglish("smoke")[0]?.consonants === "עשן", "translate 'smoke' → עשן first");

console.log(`\n${passed} passed, ${failed} failed${LIVE ? " (live)" : ""}`);
process.exit(failed ? 1 : 0);
