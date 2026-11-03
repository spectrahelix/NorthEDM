// Local birth time → UTC instant(s), and the sunset decision for the Hebrew date.
//
// Conventions (shown on every report):
// - Time zone: the IANA zone for the birthplace, with the historical offset the
//   runtime's tz database gives for that date (not the viewer's zone).
// - Sunset: apparent sunset of the Sun's upper limb with standard refraction
//   (Astronomy Engine). The Hebrew date advances at sunset.
// - Twilight: from sunset until the Sun is 8.5° below the horizon (a common
//   "three stars" nightfall). A birth in that window is flagged: authorities
//   differ on when the day turns, so both dates are kept.

import * as Astronomy from "astronomy-engine";
import { hebrewFromRd, rdFromIso, isoFromRd, type HebrewDate } from "./hebrewCalendar.ts";

export const SUNSET_CONVENTION =
  "Apparent sunset (upper limb, standard refraction); twilight until the Sun is 8.5° below the horizon.";
const NIGHTFALL_DEPRESSION = -8.5;

// ---------- wall clock → UTC ----------

/** Offset (minutes east of UTC) of `zone` at instant `ms`. */
export function zoneOffsetMinutes(zone: string, ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

export type WallTimeResolution =
  | { kind: "ok"; utcMs: number; offsetMinutes: number }
  | { kind: "fold"; candidates: Array<{ utcMs: number; offsetMinutes: number }> } // clock repeated (DST ends)
  | { kind: "gap" }; // clock skipped (DST starts) — that time never happened there

/** Every UTC instant whose local clock in `zone` reads `iso` + `hhmm`. */
export function resolveWallTime(isoDate: string, hhmm: string, zone: string): WallTimeResolution {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // Offsets in use within ±1 day cover any transition near this time.
  const offsets = new Set<number>();
  for (const dh of [-26, -14, -2, 0, 2, 14, 26]) offsets.add(zoneOffsetMinutes(zone, naive + dh * 3600000));
  const hits: Array<{ utcMs: number; offsetMinutes: number }> = [];
  for (const off of offsets) {
    const utc = naive - off * 60000;
    if (zoneOffsetMinutes(zone, utc) === off) hits.push({ utcMs: utc, offsetMinutes: off });
  }
  hits.sort((a, b) => a.utcMs - b.utcMs);
  if (hits.length === 0) return { kind: "gap" };
  if (hits.length === 1) return { kind: "ok", ...hits[0] };
  return { kind: "fold", candidates: hits };
}

/** UTC instant of local midnight starting `isoDate` (first instant of that local day). */
export function localDayStartUtc(isoDate: string, zone: string): number {
  for (const t of ["00:00", "00:30", "01:00", "01:30", "02:00", "03:00"]) {
    const r = resolveWallTime(isoDate, t, zone);
    if (r.kind === "ok") return r.utcMs;
    if (r.kind === "fold") return r.candidates[0].utcMs;
  }
  throw new Error("Could not find the start of that day in this time zone.");
}

export function formatOffset(min: number): string {
  const s = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `UTC${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

// ---------- sunset ----------

export type SunsetInfo =
  | { kind: "ok"; sunsetUtcMs: number; nightfallUtcMs: number | null }
  | { kind: "none"; reason: string }; // polar day/night

export function sunsetFor(isoDate: string, lat: number, lon: number, zone: string): SunsetInfo {
  const observer = new Astronomy.Observer(lat, lon, 0);
  const dayStart = localDayStartUtc(isoDate, zone);
  const nextDayStart = localDayStartUtc(isoFromRd(rdFromIso(isoDate) + 1), zone);
  const start = Astronomy.MakeTime(new Date(dayStart));
  const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, start, 1);
  if (!set || set.date.getTime() >= nextDayStart) {
    return { kind: "none", reason: "The Sun does not set at this place on this date (polar day or night), so the evening boundary can't be calculated." };
  }
  const dusk = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, set, 1, NIGHTFALL_DEPRESSION);
  return { kind: "ok", sunsetUtcMs: set.date.getTime(), nightfallUtcMs: dusk ? dusk.date.getTime() : null };
}

// ---------- the Hebrew-date decision ----------

export type HebrewDateOption = {
  condition: "before-sunset" | "after-sunset";
  hebrew: HebrewDate;
};

export type HebrewDateDecision = {
  status: "confirmed" | "uncertain";
  confirmed?: HebrewDateOption;
  options: HebrewDateOption[]; // both, always — the timing table shows them
  reason: string;
  sunsetUtcMs?: number;
  nightfallUtcMs?: number | null;
};

/**
 * Decide the Hebrew birth date. `birthUtcMs` may be a range [earliest, latest]
 * (approximate time, or a DST fold); `null` = time unknown.
 */
export function decideHebrewDate(
  isoDate: string,
  birthUtcRange: [number, number] | null,
  place: { lat: number; lon: number; zone: string } | null
): HebrewDateDecision {
  const rd = rdFromIso(isoDate);
  const options: HebrewDateOption[] = [
    { condition: "before-sunset", hebrew: hebrewFromRd(rd) },
    { condition: "after-sunset", hebrew: hebrewFromRd(rd + 1) },
  ];
  if (!birthUtcRange) {
    return { status: "uncertain", options, reason: "Birth time unknown, so both the daytime date and the date after sunset are possible." };
  }
  if (!place) {
    return { status: "uncertain", options, reason: "Birthplace not resolved, so local sunset can't be calculated." };
  }
  const s = sunsetFor(isoDate, place.lat, place.lon, place.zone);
  if (s.kind === "none") return { status: "uncertain", options, reason: s.reason };
  const [lo, hi] = birthUtcRange;
  const night = s.nightfallUtcMs ?? s.sunsetUtcMs;
  if (hi < s.sunsetUtcMs) {
    return { status: "confirmed", confirmed: options[0], options, reason: "Born before local sunset.", sunsetUtcMs: s.sunsetUtcMs, nightfallUtcMs: s.nightfallUtcMs };
  }
  if (lo >= night) {
    return { status: "confirmed", confirmed: options[1], options, reason: "Born after local sunset and nightfall, so the Hebrew date had already advanced.", sunsetUtcMs: s.sunsetUtcMs, nightfallUtcMs: s.nightfallUtcMs };
  }
  const why = lo < s.sunsetUtcMs && hi >= s.sunsetUtcMs
    ? "The possible birth times straddle local sunset."
    : "Born in twilight, between sunset and nightfall; authorities differ on when the day turns.";
  return { status: "uncertain", options, reason: why, sunsetUtcMs: s.sunsetUtcMs, nightfallUtcMs: s.nightfallUtcMs };
}
