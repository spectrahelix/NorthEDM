// Assemble a birth-chart report from validated input. Server-side (it reads
// the lexicon). The shape matches .claude/skills/hebrew-birth-chart's report
// JSON, so the agent skill's PDF renderer can render a site report too.

import { calculateGematria, GEMATRIA_METHOD, hebrewNumeral } from "./gematria.ts";
import { rdFromIso, isoFromRd, type HebrewDate, observancesOn } from "./hebrewCalendar.ts";
import { resolveWallTime, localDayStartUtc, decideHebrewDate, formatOffset, zoneOffsetMinutes, SUNSET_CONVENTION } from "./birthTiming.ts";
import { calculateAstrology, type AstrologyResult } from "./astrology.ts";
import { wordsWithValue, countWithValue, LEXICON_SOURCE, type LexiconEntry } from "./lexicon.ts";
import { SOURCES, NUMBER_ASSOCIATIONS, WEEKDAY_CONTEXT, MONTH_SIGNS, OBSERVANCE_NOTES, INTERPRETIVE_NOTE, type Source } from "./associations.ts";

export const REPORT_SCHEMA_VERSION = 1;

export type ComponentRole = "given" | "middle" | "surname" | "suffix";

export type BirthChartInput = {
  displayName?: string;
  components: Array<{
    original: string;
    role: ComponentRole;
    hebrew: string;
    meaning?: string;
    meaningSourceUrl?: string;
  }>;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM, 24h
  timeAccuracy: "exact" | "approximate" | "unknown";
  plusMinusMinutes?: number;
  foldChoice?: "earlier" | "later";
  place: { label: string; lat: number; lon: number; zone: string };
  chosenMatches?: Record<string, string>; // row key → Strong's id, "none" to show no word
};

export class ReportInputError extends Error {}

export type MatchOption = { strongs: string; hebrew: string; pronunciation: string; meaning: string; url: string };

export type NumberRow = {
  key: string;
  value: number;
  originLabel: string;
  matchedHebrew?: string;
  pronunciation?: string;
  meaningOrAssociation: string;
  kind: "exact-word-value" | "traditional-number-symbolism" | "arithmetic-only" | "calendar-label" | "not-verified";
  status: string;
  sourceIds: string[];
  options: MatchOption[]; // other dictionary words with this value (for the chooser)
  totalMatches: number;
};

export type Report = {
  schemaVersion: number;
  generatedAt: string;
  method: typeof GEMATRIA_METHOD;
  displayName: string;
  birth: {
    gregorian: string;
    gregorianLabel: string;
    localTime: string | null;
    timeAccuracy: BirthChartInput["timeAccuracy"];
    plusMinusMinutes: number | null;
    place: string;
    lat: number;
    lon: number;
    timeZone: string;
    utcOffset: string;
    instantUtc: string | null;
    sunsetLocal: string | null;
    nightfallLocal: string | null;
    sunsetConvention: string;
  };
  hebrewDate: { status: "confirmed" | "uncertain"; label: string; hebrew: string; weekday: string; note: string; sourceIds: string[] };
  fullHebrewName: string;
  nameChart: Array<{
    componentId: string;
    originalName: string;
    role: ComponentRole;
    historicalMeaning: string;
    hebrewSpelling: string;
    letters: Array<{ letter: string; value: number }>;
    value: number;
    sourceIds: string[];
  }>;
  totals: { base: number; suffix: number; combined: number };
  timingChart: Array<{ condition: string; hebrewDate: string; hebrew: string; matchedHebrew?: string; pronunciation?: string; meaning: string; value: number; confirmed: boolean; sourceIds: string[] }>;
  numberChart: NumberRow[];
  contextChart: Array<{ connection: string; figureOrConcept: string; tradition: string; explanation: string; relationship: "calendar-context" | "religious-concept" | "name-etymology"; sourceIds: string[] }>;
  astrology: AstrologyResult;
  warnings: string[];
  sources: Source[];
  note: string;
};

const ROLE_LABEL: Record<ComponentRole, string> = { given: "First name", middle: "Middle name", surname: "Surname", suffix: "Suffix" };

function localTimeLabel(ms: number, zone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(ms));
}

function clock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function toMatch(e: LexiconEntry): MatchOption {
  return { strongs: e.strongs, hebrew: e.consonants, pronunciation: e.xlit, meaning: e.definition || e.kjv, url: e.url };
}

export function buildReport(input: BirthChartInput): Report {
  const warnings: string[] = [];
  const usedSources = new Map<string, Source>();
  const cite = (...ids: string[]) => ids.forEach((id) => SOURCES[id] && usedSources.set(id, SOURCES[id]));

  // ---------- validate ----------
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ReportInputError("Enter the birth date.");
  const year = Number(input.date.slice(0, 4));
  if (year < 1800 || year > 2200) throw new ReportInputError("Birth year must be between 1800 and 2200.");
  if (!input.place || !Number.isFinite(input.place.lat) || !Number.isFinite(input.place.lon) || !input.place.zone) {
    throw new ReportInputError("Choose the birthplace from the search results.");
  }
  if (input.timeAccuracy !== "unknown" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time ?? "")) {
    throw new ReportInputError("Enter the birth time, or choose Unknown.");
  }
  const comps = input.components.filter((c) => c.original.trim() || c.hebrew.trim());
  if (comps.length === 0) throw new ReportInputError("Enter at least one name.");
  if (comps.length > 8) throw new ReportInputError("Up to 8 name parts.");
  const zone = input.place.zone;

  // ---------- birth instant ----------
  let window: [number, number];
  let instant: number | null = null;
  if (input.timeAccuracy === "unknown") {
    const start = localDayStartUtc(input.date, zone);
    const end = localDayStartUtc(isoFromRd(rdFromIso(input.date) + 1), zone) - 1;
    window = [start, end];
  } else {
    const r = resolveWallTime(input.date, input.time as string, zone);
    if (r.kind === "gap") {
      throw new ReportInputError(`${input.time} didn't happen in ${zone} on that date: the clocks jumped forward for daylight saving time. Check the time on the record.`);
    }
    let t: number;
    let spread: [number, number] | null = null;
    if (r.kind === "fold") {
      if (input.foldChoice === "earlier") t = r.candidates[0].utcMs;
      else if (input.foldChoice === "later") t = r.candidates[1].utcMs;
      else {
        t = r.candidates[0].utcMs;
        spread = [r.candidates[0].utcMs, r.candidates[1].utcMs];
        warnings.push(`${input.time} happened twice that night (clocks went back an hour). Both moments are kept; choose earlier or later if you know which.`);
      }
    } else t = r.utcMs;
    const pm = input.timeAccuracy === "approximate" ? Math.min(Math.max(input.plusMinusMinutes ?? 30, 1), 720) : 0;
    window = spread ? [spread[0] - pm * 60000, spread[1] + pm * 60000] : [t - pm * 60000, t + pm * 60000];
    if (window[0] === window[1]) instant = t;
  }

  // ---------- Hebrew date ----------
  const decision = decideHebrewDate(input.date, input.timeAccuracy === "unknown" ? null : window, input.place);
  cite("hebcal");
  const confirmed = decision.confirmed;
  const primary = confirmed ? confirmed.hebrew : decision.options[0].hebrew;
  const sunsetLocal = decision.sunsetUtcMs ? localTimeLabel(decision.sunsetUtcMs, zone) : null;
  const nightfallLocal = decision.nightfallUtcMs ? localTimeLabel(decision.nightfallUtcMs, zone) : null;
  const dateNote = confirmed
    ? `${confirmed.hebrew.weekdayName}. ${decision.reason}${sunsetLocal ? ` Local sunset was ${sunsetLocal}.` : ""}`
    : `${decision.reason} Both possible Hebrew dates are shown below; neither is selected.`;

  // ---------- names ----------
  const nameChart = comps.map((c, i) => {
    let g;
    try {
      g = calculateGematria(c.hebrew);
    } catch (e) {
      throw new ReportInputError(`${c.original || ROLE_LABEL[c.role]}: ${(e as Error).message}`);
    }
    const ids: string[] = [];
    if (c.meaningSourceUrl && /^https?:\/\//.test(c.meaningSourceUrl)) {
      const id = `name-${i}`;
      let host = "";
      try { host = new URL(c.meaningSourceUrl).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
      usedSources.set(id, { id, label: `Name meaning: ${c.original}`, site: host, url: c.meaningSourceUrl });
      ids.push(id);
    }
    return {
      componentId: `${c.role}-${i}`,
      originalName: c.original.trim() || ROLE_LABEL[c.role],
      role: c.role,
      historicalMeaning: c.meaning?.trim() || "Not supplied. A phonetic spelling is not a translation of the name's meaning.",
      hebrewSpelling: g.normalizedHebrew === c.hebrew.trim() ? c.hebrew.trim() : c.hebrew.trim(),
      letters: g.letters,
      value: g.total,
      sourceIds: ids,
    };
  });
  const base = nameChart.filter((n) => n.role !== "suffix").reduce((s, n) => s + n.value, 0);
  const suffix = nameChart.filter((n) => n.role === "suffix").reduce((s, n) => s + n.value, 0);
  const combined = base + suffix;

  // ---------- number rows ----------
  const chosen = input.chosenMatches ?? {};
  const numberRow = (key: string, value: number, originLabel: string, extraStatus?: string): NumberRow => {
    const curated = NUMBER_ASSOCIATIONS[value];
    const matches = wordsWithValue(value, 40);
    const options = matches.map(toMatch);
    const totalMatches = countWithValue(value);
    if (curated && chosen[key] === undefined) {
      cite(...curated.sourceIds);
      return {
        key, value, originLabel,
        matchedHebrew: curated.hebrew, pronunciation: curated.pronunciation,
        meaningOrAssociation: curated.meaning,
        kind: "traditional-number-symbolism",
        status: `${curated.tradition}.${extraStatus ? " " + extraStatus : ""}`,
        sourceIds: curated.sourceIds, options, totalMatches,
      };
    }
    const pick = chosen[key] === "none" ? undefined : matches.find((m) => m.strongs === chosen[key]) ?? matches[0];
    if (pick) {
      usedSources.set(LEXICON_SOURCE.id, LEXICON_SOURCE);
      const id = `lex-${pick.strongs}`;
      usedSources.set(id, { id, label: `Strong's ${pick.strongs}: ${pick.xlit}`, site: "biblehub.com", url: pick.url });
      return {
        key, value, originLabel,
        matchedHebrew: pick.consonants, pronunciation: pick.xlit,
        meaningOrAssociation: pick.definition || pick.kjv,
        kind: "exact-word-value",
        status: `Exact dictionary match${totalMatches > 1 ? `, one of ${totalMatches}` : ""}; not the meaning of the name.${extraStatus ? " " + extraStatus : ""}`,
        sourceIds: [id, LEXICON_SOURCE.id], options, totalMatches,
      };
    }
    return {
      key, value, originLabel,
      meaningOrAssociation: "No additional sourced association verified for this report.",
      kind: value === combined || value === base ? "arithmetic-only" : "not-verified",
      status: "Arithmetic total; no association asserted.",
      sourceIds: [], options, totalMatches,
    };
  };

  const numberChart: NumberRow[] = [];
  nameChart.forEach((n) => numberChart.push(numberRow(n.componentId, n.value, `${n.originalName} spelling`)));
  if (nameChart.filter((n) => n.role !== "suffix").length > 1) numberChart.push(numberRow("base", base, suffix ? "Name total without suffix" : "Full-name total"));
  if (suffix) numberChart.push(numberRow("combined", combined, "Name plus suffix"));
  const dayRows = confirmed ? [confirmed] : decision.options;
  for (const o of dayRows) {
    const label = confirmed ? "Hebrew birth day" : `Hebrew day if ${o.condition === "before-sunset" ? "before" : "after"} sunset`;
    numberChart.push(numberRow(`day-${o.condition}`, o.hebrew.day, label, confirmed ? undefined : "Unconfirmed alternative."));
  }
  numberChart.push({
    key: "year", value: primary.year, originLabel: "Hebrew birth year",
    meaningOrAssociation: `The year ${hebrewNumeral(primary.year)}. A calendar label; no word or meaning is asserted.`,
    kind: "calendar-label", status: "Calendar label.", sourceIds: [], options: [], totalMatches: 0,
  });

  // ---------- timing table ----------
  const timingChart = decision.options.map((o) => {
    const isConfirmed = confirmed?.condition === o.condition;
    const cur = NUMBER_ASSOCIATIONS[o.hebrew.day];
    if (cur) cite(...cur.sourceIds);
    return {
      condition: `${o.condition === "before-sunset" ? "Before sunset" : "After sunset"}: ${isConfirmed ? "confirmed" : confirmed ? "alternative, not this birth" : "possible"}`,
      hebrewDate: o.hebrew.label,
      hebrew: `${hebrewNumeral(o.hebrew.day)} ב${o.hebrew.monthHebrew}`,
      matchedHebrew: cur?.hebrew,
      pronunciation: cur?.pronunciation,
      meaning: cur ? cur.meaning : `${o.hebrew.weekdayName}`,
      value: o.hebrew.day,
      confirmed: isConfirmed,
      sourceIds: cur ? cur.sourceIds : ["hebcal"],
    };
  });

  // ---------- context ----------
  const contextChart: Report["contextChart"] = [];
  const contextFor = (h: HebrewDate, suffixLabel: string) => {
    const wd = WEEKDAY_CONTEXT[h.weekday];
    cite("genesis1");
    contextChart.push({ connection: `Weekday: ${h.weekdayName}${suffixLabel}`, figureOrConcept: wd.figure, tradition: "Torah (Genesis)", explanation: wd.explanation, relationship: "religious-concept", sourceIds: ["genesis1"] });
    if (wd.extra) {
      cite(...wd.extra.sourceIds);
      contextChart.push({ connection: `Weekday: ${h.weekdayName}${suffixLabel}`, figureOrConcept: wd.extra.figure, tradition: wd.extra.tradition, explanation: wd.extra.explanation, relationship: "religious-concept", sourceIds: wd.extra.sourceIds });
    }
    const ms = MONTH_SIGNS[h.monthName];
    if (ms) {
      cite("jeZodiac", "mayimZodiac");
      contextChart.push({
        connection: `Month: ${h.monthName}${suffixLabel}`,
        figureOrConcept: `${ms.name} (${ms.western})`,
        tradition: "Jewish month-sign tradition",
        explanation: `The traditional sign of ${h.monthName} is ${ms.hebrew} (${ms.western}). This is a correspondence of the Hebrew month, separate from the calculated Western Sun sign.`,
        relationship: "calendar-context",
        sourceIds: ["jeZodiac", "mayimZodiac"],
      });
    }
    for (const o of observancesOn(h)) {
      const n = OBSERVANCE_NOTES[o];
      if (n) cite(...n.sourceIds);
      contextChart.push({
        connection: `Hebrew date: ${h.day} ${h.monthName}${suffixLabel}`,
        figureOrConcept: o,
        tradition: "Jewish calendar",
        explanation: n?.explanation ?? `${o} falls on this Hebrew date.`,
        relationship: "calendar-context",
        sourceIds: n ? [...n.sourceIds, "hebcal"] : ["hebcal"],
      });
    }
  };
  if (confirmed) contextFor(confirmed.hebrew, "");
  else for (const o of decision.options) contextFor(o.hebrew, o.condition === "before-sunset" ? " (if before sunset)" : " (if after sunset)");

  // ---------- astrology ----------
  const astrology = calculateAstrology({
    window,
    timeBasis: input.timeAccuracy === "unknown" ? "unknown" : window[0] === window[1] ? "exact" : "approximate",
    lat: input.place.lat,
    lon: input.place.lon,
  });
  cite("astronomyEngine", "osm");

  const off = zoneOffsetMinutes(zone, instant ?? window[0]);
  const gregLabel = new Date(`${input.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const displayName = (input.displayName?.trim() || comps.map((c) => c.original.trim()).filter(Boolean).join(" ") || "Hebrew Birth Chart").slice(0, 120);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    method: GEMATRIA_METHOD,
    displayName,
    birth: {
      gregorian: input.date,
      gregorianLabel: gregLabel,
      localTime: input.timeAccuracy === "unknown" || !input.time ? null : clock12(input.time),
      timeAccuracy: input.timeAccuracy,
      plusMinusMinutes: input.timeAccuracy === "approximate" ? input.plusMinusMinutes ?? 30 : null,
      place: input.place.label,
      lat: input.place.lat,
      lon: input.place.lon,
      timeZone: zone,
      utcOffset: formatOffset(off),
      instantUtc: instant == null ? null : new Date(instant).toISOString(),
      sunsetLocal,
      nightfallLocal,
      sunsetConvention: SUNSET_CONVENTION,
    },
    hebrewDate: { status: decision.status, label: primary.label, hebrew: primary.hebrew, weekday: primary.weekdayName, note: dateNote, sourceIds: ["hebcal"] },
    fullHebrewName: nameChart.map((n) => n.hebrewSpelling).join(" "),
    nameChart,
    totals: { base, suffix, combined },
    timingChart,
    numberChart,
    contextChart,
    astrology,
    warnings: [...warnings, ...(astrology.status === "available" ? astrology.notes : [])],
    sources: [...usedSources.values()],
    note: INTERPRETIVE_NOTE,
  };
}

// ---------- number lookup & words ----------

export function lookupNumber(n: number) {
  const curated = NUMBER_ASSOCIATIONS[n];
  return {
    value: n,
    numeral: hebrewNumeral(n),
    curated: curated ?? null,
    matches: wordsWithValue(n, 20).map(toMatch),
    totalMatches: countWithValue(n),
  };
}
