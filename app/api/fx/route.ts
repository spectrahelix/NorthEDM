import { NextResponse } from "next/server";
import { rate } from "@/utils/fx";

/**
 * Indicative exchange rate for price previews ("≈ D 935 at today's rate").
 * Never used to charge anyone — prices are stored and charged in the shop's
 * own currency. The rate itself comes from utils/fx.ts.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = (u.searchParams.get("from") || "USD").toUpperCase().slice(0, 3);
  const to = (u.searchParams.get("to") || "GMD").toUpperCase().slice(0, 3);
  if (from === to) return NextResponse.json({ from, to, rate: 1, date: null, estimate: true });
  const r = await rate(from, to);
  if (!r) return NextResponse.json({ error: "No rate available." }, { status: 503 });
  return NextResponse.json({ from, to, rate: r.rate, date: r.date, estimate: true, ...(r.fallback ? { fallback: true } : {}) });
}
