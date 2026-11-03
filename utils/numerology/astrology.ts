// Western astrology from a real ephemeris: Astronomy Engine (MIT licence,
// github.com/cosinekitty/astronomy). Positions are geocentric, apparent
// (light-time + aberration), on the true ecliptic and equinox of date.
// Tropical zodiac; Whole Sign houses. scripts/test-astro-hebrew.mjs checks the
// planets against NASA JPL Horizons and the Ascendant/Midheaven against a
// direct search of the sky, so a wrong formula fails the test.
//
// Nothing here guesses: unknown birth time → no Ascendant, Midheaven, houses
// or aspects, and a planet that changes sign during the day is reported as
// "X or Y", not as one of them.

import * as Astronomy from "astronomy-engine";

export const ASTROLOGY_SETTINGS = {
  provider: "Astronomy Engine 2.1.19 (MIT)",
  zodiac: "Tropical",
  houseSystem: "Whole Sign",
  frame: "Geocentric, apparent, true ecliptic of date",
  orbs: "orbs-v1: conjunction, opposition, square, trine 8°; sextile 6°",
} as const;

import { SIGNS, BODIES, BODY_GLYPHS, type Sign, type BodyName } from "./zodiac.ts";
export { SIGNS, SIGN_GLYPHS, BODIES, BODY_GLYPHS, type Sign, type BodyName } from "./zodiac.ts";

const norm = (d: number) => ((d % 360) + 360) % 360;
const rad = Math.PI / 180;

export function signOf(lon: number): { sign: Sign; signIndex: number; degree: number; label: string } {
  const l = norm(lon);
  const i = Math.floor(l / 30);
  const within = l - i * 30;
  const deg = Math.floor(within);
  const min = Math.floor((within - deg) * 60);
  return { sign: SIGNS[i], signIndex: i, degree: within, label: `${deg}°${String(min).padStart(2, "0")}′ ${SIGNS[i]}` };
}

/** Apparent geocentric ecliptic longitude (true ecliptic of date), degrees. */
export function eclipticLongitude(body: BodyName, ms: number): number {
  const t = Astronomy.MakeTime(new Date(ms));
  const v = Astronomy.GeoVector(Astronomy.Body[body], t, true);
  return norm(Astronomy.Ecliptic(v).elon);
}

/** Daily motion sign: negative = retrograde. */
function isRetrograde(body: BodyName, ms: number): boolean {
  if (body === "Sun" || body === "Moon") return false;
  const a = eclipticLongitude(body, ms - 6 * 3600000);
  const b = eclipticLongitude(body, ms + 6 * 3600000);
  return ((b - a + 540) % 360) - 180 < 0;
}

/** Ascendant and Midheaven (degrees), from local apparent sidereal time. */
export function anglesAt(ms: number, lat: number, lon: number): { asc: number; mc: number } {
  const t = Astronomy.MakeTime(new Date(ms));
  const ramc = norm(Astronomy.SiderealTime(t) * 15 + lon) * rad; // GAST + east longitude
  const eps = Astronomy.e_tilt(t).tobl * rad; // true obliquity
  const phi = lat * rad;
  const mc = norm(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) / rad);
  const asc = norm(Math.atan2(Math.cos(ramc), -(Math.sin(eps) * Math.tan(phi) + Math.cos(eps) * Math.sin(ramc))) / rad);
  return { asc, mc };
}

export type Placement = {
  body: BodyName;
  glyph: string;
  longitude: number | null; // null when time unknown and it moved a lot
  label: string; // "1°37′ Leo" or "Cancer or Leo"
  sign: Sign | null;
  possibleSigns: Sign[];
  retrograde: boolean;
  house: number | null;
};

export type Aspect = { a: BodyName; b: BodyName; type: string; exact: number; orb: number };

export type AstrologyResult =
  | { status: "unavailable"; reason: string }
  | {
      status: "available";
      settings: typeof ASTROLOGY_SETTINGS;
      timeBasis: "exact" | "approximate" | "unknown";
      instantUtc: string | null;
      window: { fromUtc: string; toUtc: string } | null;
      placements: Placement[];
      ascendant: { longitude: number; label: string } | null;
      midheaven: { longitude: number; label: string } | null;
      houses: Array<{ house: number; sign: Sign; cusp: number }> | null;
      aspects: Aspect[] | null;
      notes: string[];
    };

const ASPECTS: Array<{ type: string; angle: number; orb: number }> = [
  { type: "Conjunction", angle: 0, orb: 8 },
  { type: "Sextile", angle: 60, orb: 6 },
  { type: "Square", angle: 90, orb: 8 },
  { type: "Trine", angle: 120, orb: 8 },
  { type: "Opposition", angle: 180, orb: 8 },
];

function aspectsBetween(lons: Array<{ body: BodyName; lon: number }>): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < lons.length; i++) {
    for (let j = i + 1; j < lons.length; j++) {
      const sep = Math.abs(((lons[i].lon - lons[j].lon + 540) % 360) - 180);
      for (const a of ASPECTS) {
        const orb = Math.abs(sep - a.angle);
        if (orb <= a.orb) out.push({ a: lons[i].body, b: lons[j].body, type: a.type, exact: a.angle, orb: Math.round(orb * 100) / 100 });
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

/** Signs a body passes through between two instants (sampled hourly). */
function signsOver(body: BodyName, from: number, to: number): Sign[] {
  const seen: Sign[] = [];
  const step = 3600000;
  for (let t = from; ; t += step) {
    const s = signOf(eclipticLongitude(body, Math.min(t, to))).sign;
    if (!seen.includes(s)) seen.push(s);
    if (t >= to) break;
  }
  return seen;
}

/**
 * Build the chart. `window` is the span the birth could fall in:
 * [t, t] for an exact time, [t-δ, t+δ] approximate, the whole local day if unknown.
 */
export function calculateAstrology(input: {
  window: [number, number];
  timeBasis: "exact" | "approximate" | "unknown";
  lat: number | null;
  lon: number | null;
}): AstrologyResult {
  const [from, to] = input.window;
  const mid = (from + to) / 2;
  const exact = from === to;
  const notes: string[] = [];

  let asc: number | null = null;
  let mc: number | null = null;
  if (input.timeBasis !== "unknown" && input.lat != null && input.lon != null) {
    if (Math.abs(input.lat) > 66) {
      notes.push("Ascendant and houses are not calculated above the polar circles, where the ecliptic can fail to rise.");
    } else {
      const a0 = anglesAt(from, input.lat, input.lon);
      const a1 = anglesAt(to, input.lat, input.lon);
      if (signOf(a0.asc).sign === signOf(a1.asc).sign && signOf(a0.mc).sign === signOf(a1.mc).sign) {
        const am = anglesAt(mid, input.lat, input.lon);
        asc = am.asc;
        mc = am.mc;
      } else {
        notes.push(`The Ascendant changes sign within the possible birth times (${signOf(a0.asc).sign} → ${signOf(a1.asc).sign}), so houses are left out.`);
      }
    }
  } else if (input.timeBasis === "unknown") {
    notes.push("Birth time unknown: no Ascendant, Midheaven, houses or aspects. Planets are listed for the whole local day; any that changed sign that day show both signs.");
  }

  const ascSign = asc == null ? null : signOf(asc).signIndex;
  const placements: Placement[] = BODIES.map((body) => {
    const possible = exact ? [signOf(eclipticLongitude(body, from)).sign] : signsOver(body, from, to);
    const lon = eclipticLongitude(body, mid);
    const single = possible.length === 1;
    const s = signOf(lon);
    return {
      body,
      glyph: BODY_GLYPHS[body],
      longitude: single ? lon : null,
      label: single ? (input.timeBasis === "unknown" ? s.sign : s.label) : possible.join(" or "),
      sign: single ? s.sign : null,
      possibleSigns: possible,
      retrograde: isRetrograde(body, mid),
      house: single && ascSign != null ? ((s.signIndex - ascSign + 12) % 12) + 1 : null,
    };
  });

  const known = placements.filter((p) => p.longitude != null).map((p) => ({ body: p.body, lon: p.longitude as number }));
  const aspects = input.timeBasis === "unknown" ? null : aspectsBetween(known);

  return {
    status: "available",
    settings: ASTROLOGY_SETTINGS,
    timeBasis: input.timeBasis,
    instantUtc: exact ? new Date(from).toISOString() : null,
    window: exact ? null : { fromUtc: new Date(from).toISOString(), toUtc: new Date(to).toISOString() },
    placements,
    ascendant: asc == null ? null : { longitude: asc, label: signOf(asc).label },
    midheaven: mc == null ? null : { longitude: mc, label: signOf(mc).label },
    houses: ascSign == null ? null : Array.from({ length: 12 }, (_, i) => ({ house: i + 1, sign: SIGNS[(ascSign + i) % 12], cusp: ((ascSign + i) % 12) * 30 })),
    aspects,
    notes,
  };
}
