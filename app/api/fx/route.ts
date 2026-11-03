import { NextResponse } from "next/server";

/**
 * Indicative exchange rate for price previews ("≈ D 935 at today's rate").
 * Source: open.er-api.com (free, daily), cached an hour. Never used to charge
 * anyone — prices are stored and charged in the shop's own currency; this is
 * only so a seller typing dollars can see the dalasi their customers will pay.
 */
const FALLBACK: Record<string, number> = { GMD: 74.66, EUR: 0.92, GBP: 0.79, CAD: 1.37 }; // per USD, Nov 2026
export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = (u.searchParams.get("from") || "USD").toUpperCase().slice(0, 3);
  const to = (u.searchParams.get("to") || "GMD").toUpperCase().slice(0, 3);
  if (from === to) return NextResponse.json({ from, to, rate: 1, date: null, estimate: true });
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${from}`, { next: { revalidate: 3600 } });
    const j = await r.json();
    const rate = Number(j?.rates?.[to]);
    if (j?.result === "success" && rate > 0) return NextResponse.json({ from, to, rate, date: j.time_last_update_utc ?? null, estimate: true });
  } catch {}
  const viaUsd = from === "USD" ? FALLBACK[to] : to === "USD" && FALLBACK[from] ? 1 / FALLBACK[from] : null;
  if (!viaUsd) return NextResponse.json({ error: "No rate available." }, { status: 503 });
  return NextResponse.json({ from, to, rate: viaUsd, date: null, estimate: true, fallback: true });
}
