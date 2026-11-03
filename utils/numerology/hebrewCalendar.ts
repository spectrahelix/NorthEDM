// Hebrew calendar, computed offline (arithmetic from Dershowitz & Reingold,
// "Calendrical Calculations"). No network call, no GPL library.
// scripts/test-astro-hebrew.mjs checks it day-by-day against Hebcal's API.
//
// Month numbers follow D&R: Nisan = 1 … Adar = 12, Adar II = 13 (leap years);
// the year number changes at 1 Tishrei (month 7).
// A civil date here means the DAYTIME Hebrew date; after local sunset the
// Hebrew date is the next civil day's — see birthTiming.ts.

import { hebrewNumeral } from "./gematria.ts";

const HEBREW_EPOCH = -1373427; // RD of 1 Tishrei AM 1

export type HebrewDate = {
  year: number;
  month: number; // 1 = Nisan … 13 = Adar II
  day: number;
  monthName: string; // Hebcal spelling: "Tevet", "Adar I", "Sh'vat"
  monthHebrew: string;
  isLeapYear: boolean;
  label: string; // "18 Tevet 5757"
  hebrew: string; // "י״ח בטבת ה׳תשנ״ז"
  weekday: number; // 0 = Sunday … 6 = Shabbat
  weekdayName: string;
};

// ---------- Gregorian <-> RD ----------

export function rdFromGregorian(y: number, m: number, d: number): number {
  const py = y - 1;
  return 365 * py + Math.floor(py / 4) - Math.floor(py / 100) + Math.floor(py / 400)
    + Math.floor((367 * m - 362) / 12)
    + (m <= 2 ? 0 : isGregorianLeap(y) ? -1 : -2) + d;
}

function isGregorianLeap(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

export function gregorianFromRd(rd: number): { year: number; month: number; day: number } {
  // Via the JS date of the Unix epoch (RD 719163 = 1970-01-01).
  const dt = new Date(Date.UTC(1970, 0, 1) + (rd - 719163) * 86400000);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function isoFromRd(rd: number): string {
  const g = gregorianFromRd(rd);
  return `${String(g.year).padStart(4, "0")}-${String(g.month).padStart(2, "0")}-${String(g.day).padStart(2, "0")}`;
}

export function rdFromIso(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new RangeError("Date must be YYYY-MM-DD.");
  return rdFromGregorian(+m[1], +m[2], +m[3]);
}

// ---------- Hebrew year structure ----------

export function isHebrewLeapYear(y: number): boolean {
  return ((7 * y + 1) % 19 + 19) % 19 < 7;
}

function lastMonthOfYear(y: number): number {
  return isHebrewLeapYear(y) ? 13 : 12;
}

function calendarElapsedDays(y: number): number {
  const monthsElapsed = Math.floor((235 * y - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  const day = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
  return (3 * (day + 1)) % 7 < 3 ? day + 1 : day;
}

function yearLengthCorrection(y: number): number {
  const ny0 = calendarElapsedDays(y - 1);
  const ny1 = calendarElapsedDays(y);
  const ny2 = calendarElapsedDays(y + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}

function newYear(y: number): number {
  return HEBREW_EPOCH + calendarElapsedDays(y) + yearLengthCorrection(y);
}

function daysInYear(y: number): number {
  return newYear(y + 1) - newYear(y);
}

function longMarheshvan(y: number): boolean {
  const d = daysInYear(y);
  return d === 355 || d === 385;
}

function shortKislev(y: number): boolean {
  const d = daysInYear(y);
  return d === 353 || d === 383;
}

export function daysInHebrewMonth(y: number, m: number): number {
  if ([2, 4, 6, 10, 13].includes(m)) return 29;
  if (m === 12 && !isHebrewLeapYear(y)) return 29;
  if (m === 8 && !longMarheshvan(y)) return 29;
  if (m === 9 && shortKislev(y)) return 29;
  return 30;
}

export function rdFromHebrew(y: number, m: number, d: number): number {
  let days = newYear(y) + d - 1;
  if (m < 7) {
    for (let mm = 7; mm <= lastMonthOfYear(y); mm++) days += daysInHebrewMonth(y, mm);
    for (let mm = 1; mm < m; mm++) days += daysInHebrewMonth(y, mm);
  } else {
    for (let mm = 7; mm < m; mm++) days += daysInHebrewMonth(y, mm);
  }
  return days;
}

// ---------- names ----------

const MONTHS: Record<number, [string, string]> = {
  1: ["Nisan", "ניסן"], 2: ["Iyyar", "אייר"], 3: ["Sivan", "סיון"], 4: ["Tamuz", "תמוז"],
  5: ["Av", "אב"], 6: ["Elul", "אלול"], 7: ["Tishrei", "תשרי"], 8: ["Cheshvan", "חשון"],
  9: ["Kislev", "כסלו"], 10: ["Tevet", "טבת"], 11: ["Sh'vat", "שבט"], 12: ["Adar", "אדר"],
  13: ["Adar II", "אדר ב׳"],
};

export function hebrewMonthName(y: number, m: number): [string, string] {
  if (m === 12 && isHebrewLeapYear(y)) return ["Adar I", "אדר א׳"];
  return MONTHS[m];
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Shabbat"];

// ---------- conversion ----------

export function hebrewFromRd(rd: number): HebrewDate {
  const approx = Math.floor((rd - HEBREW_EPOCH) / (35975351 / 98496)) + 1;
  // The estimate can be off by one at a year boundary; step until exact.
  let year = approx - 1;
  while (newYear(year + 1) <= rd) year++;
  while (newYear(year) > rd) year--;
  const start = rd < rdFromHebrew(year, 1, 1) ? 7 : 1;
  let month = start;
  while (rd > rdFromHebrew(year, month, daysInHebrewMonth(year, month))) month++;
  const day = rd - rdFromHebrew(year, month, 1) + 1;
  const [monthName, monthHebrew] = hebrewMonthName(year, month);
  const weekday = ((rd % 7) + 7) % 7; // RD 1 (0001-01-01) was a Monday → rd % 7 === 0 is Sunday
  return {
    year, month, day, monthName, monthHebrew,
    isLeapYear: isHebrewLeapYear(year),
    label: `${day} ${monthName} ${year}`,
    hebrew: `${hebrewNumeral(day)} ב${monthHebrew} ${hebrewNumeral(year)}`,
    weekday,
    weekdayName: WEEKDAYS[weekday],
  };
}

/** Daytime Hebrew date for a civil date "YYYY-MM-DD". */
export function hebrewFromIso(iso: string): HebrewDate {
  return hebrewFromRd(rdFromIso(iso));
}

// ---------- observances on a Hebrew date ----------
// Fixed-date festivals only, Diaspora schedule (the site's audience is in the
// US). Fast days that move, and the weekly portion, are left out rather than
// approximated. Checked against Hebcal's event list in the test script.

export function observancesOn(h: HebrewDate): string[] {
  const { month: m, day: d, year: y } = h;
  const out: string[] = [];
  const adarForPurim = isHebrewLeapYear(y) ? 13 : 12;
  if (m === 7 && (d === 1 || d === 2)) out.push("Rosh Hashana");
  if (m === 7 && d === 10) out.push("Yom Kippur");
  if (m === 7 && d >= 15 && d <= 21) out.push("Sukkot");
  if (m === 7 && d === 22) out.push("Shmini Atzeret");
  if (m === 7 && d === 23) out.push("Simchat Torah");
  const chanukahStart = rdFromHebrew(y, 9, 25);
  const rd = rdFromHebrew(y, m, d);
  if (rd >= chanukahStart && rd < chanukahStart + 8) out.push("Chanukah");
  if (m === 11 && d === 15) out.push("Tu BiShvat");
  if (m === adarForPurim && d === 14) out.push("Purim");
  if (m === adarForPurim && d === 15) out.push("Shushan Purim");
  if (m === 1 && d >= 15 && d <= 22) out.push("Pesach");
  if (m === 2 && d === 18) out.push("Lag BaOmer");
  if (m === 3 && (d === 6 || d === 7)) out.push("Shavuot");
  // Tisha B'Av moves to 10 Av when 9 Av is Shabbat.
  const ninthAvIsShabbat = hebrewFromRd(rdFromHebrew(y, 5, 9)).weekday === 6;
  if (m === 5 && d === (ninthAvIsShabbat ? 10 : 9)) out.push("Tish'a B'Av");
  if (m === 5 && d === 15) out.push("Tu B'Av");
  return out;
}
