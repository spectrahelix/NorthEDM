/**
 * Indicative USD exchange rates (open.er-api.com, cached 1h, fallback
 * constants). Used for price previews and to turn a USD fee into a shop's
 * currency; prices themselves are stored and charged in the shop's currency.
 */
export const FX_FALLBACK: Record<string, number> = { GMD: 74.66, EUR: 0.92, GBP: 0.79, CAD: 1.37 }; // per USD, Nov 2026

export async function rate(from: string, to: string): Promise<{ rate: number; date: string | null; fallback: boolean } | null> {
  from = from.toUpperCase(); to = to.toUpperCase();
  if (from === to) return { rate: 1, date: null, fallback: false };
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${from}`, { next: { revalidate: 3600 } });
    const j = await r.json();
    const x = Number(j?.rates?.[to]);
    if (j?.result === "success" && x > 0) return { rate: x, date: j.time_last_update_utc ?? null, fallback: false };
  } catch { /* fall through */ }
  const viaUsd = from === "USD" ? FX_FALLBACK[to] : to === "USD" && FX_FALLBACK[from] ? 1 / FX_FALLBACK[from] : null;
  return viaUsd ? { rate: viaUsd, date: null, fallback: true } : null;
}
