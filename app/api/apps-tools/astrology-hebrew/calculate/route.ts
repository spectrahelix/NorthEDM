import { NextResponse } from "next/server";
import { buildReport, lookupNumber, ReportInputError, type BirthChartInput } from "@/utils/numerology/report";
import { calculateGematria, GematriaInputError, hebrewNumberWords } from "@/utils/numerology/gematria";
import { searchEnglish, wordsWithValue, countWithValue } from "@/utils/numerology/lexicon";
import { suggestHebrewSpellings } from "@/utils/numerology/transliterate";

// One endpoint for the calculator's four modes. Everything here is
// deterministic, local computation (calendar, gematria, ephemeris, lexicon);
// no birth details are stored or logged. Guests can use it without an account.

type Body =
  | { mode: "chart"; input: BirthChartInput }
  | { mode: "number"; value: number }
  | { mode: "translate"; english: string }
  | { mode: "sound"; name: string }
  | { mode: "analyze"; hebrew: string };

const MAX_BODY = 20_000;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: Body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    switch (body.mode) {
      case "chart":
        return NextResponse.json({ report: buildReport(body.input) });

      case "number": {
        const n = Number(body.value);
        if (!Number.isInteger(n) || n < 0 || n > 9999) {
          return NextResponse.json({ error: "Enter a whole number from 0 to 9,999." }, { status: 400 });
        }
        return NextResponse.json({ ...lookupNumber(n), words: hebrewNumberWords(n) });
      }

      case "translate": {
        const results = searchEnglish(String(body.english ?? ""), 15).map((e) => ({
          strongs: e.strongs, hebrew: e.consonants, pointed: e.lemma, pronunciation: e.xlit,
          meaning: e.definition, kjv: e.kjv, value: e.value, url: e.url,
        }));
        return NextResponse.json({ results });
      }

      case "sound": {
        const name = String(body.name ?? "").slice(0, 60);
        const suggestions = suggestHebrewSpellings(name).map((s) => ({ ...s, value: calculateGematria(s.hebrew).total }));
        return NextResponse.json({ suggestions });
      }

      case "analyze": {
        const g = calculateGematria(String(body.hebrew ?? "").slice(0, 200));
        return NextResponse.json({
          ...g,
          sameValue: wordsWithValue(g.total, 12).map((e) => ({ strongs: e.strongs, hebrew: e.consonants, pronunciation: e.xlit, meaning: e.definition, url: e.url })),
          totalMatches: countWithValue(g.total),
        });
      }

      default:
        return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof ReportInputError || e instanceof GematriaInputError || e instanceof RangeError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("apps-tools calculate failed:", (e as Error).message);
    return NextResponse.json({ error: "The calculation failed. Your entries are still on the page; try again." }, { status: 500 });
  }
}
