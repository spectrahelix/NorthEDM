"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/utils/money";

type Ctx = { viewer: string; setViewer: (c: string) => void; rate: (from: string, to: string) => number | null };
const CurrencyCtx = createContext<Ctx>({ viewer: "USD", setViewer: () => {}, rate: () => null });
const COOKIE = "ne_currency";

/** Viewer's display currency + a small cache of indicative rates from /api/fx. */
export function CurrencyProvider({ initial, children }: { initial: string; children: React.ReactNode }) {
  const [viewer, setViewerState] = useState(initial);
  const [rates, setRates] = useState<Record<string, number>>({});
  const pending = useRef(new Set<string>());
  const setViewer = useCallback((c: string) => {
    setViewerState(c);
    try { document.cookie = `${COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`; } catch {}
  }, []);
  const rate = useCallback((from: string, to: string) => {
    if (from === to) return 1;
    const key = `${from}:${to}`;
    if (rates[key]) return rates[key];
    if (!pending.current.has(key)) {
      pending.current.add(key);
      fetch(`/api/fx?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.rate) setRates((m) => ({ ...m, [key]: j.rate })); }).catch(() => {});
    }
    return null;
  }, [rates]);
  const value = useMemo(() => ({ viewer, setViewer, rate }), [viewer, setViewer, rate]);
  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}
export const useCurrency = () => useContext(CurrencyCtx);

/**
 * A price in the shop's currency, followed by "≈" in the viewer's currency
 * when they differ. Display only; the shop's currency is what gets charged.
 */
export function Price({ cents, currency = "USD", className, style, approxClassName = "ml-2 font-dm-mono text-[0.55em] font-normal text-neutral-400", approx = true }: { cents: number; currency?: string; className?: string; style?: React.CSSProperties; approxClassName?: string; approx?: boolean }) {
  const { viewer, rate } = useCurrency();
  const cur = (currency || "USD").toUpperCase();
  const r = approx && viewer !== cur ? rate(cur, viewer) : null;
  return (
    <span className={className} style={style}>
      {formatMoney(cents, cur)}
      {r ? <span className={approxClassName}>≈ {formatMoney(Math.round(cents * r), viewer)}</span> : null}
    </span>
  );
}

/** "Prices in" pill: lets the visitor choose the currency the ≈ figures use. */
export function CurrencyPill({ className = "", options }: { className?: string; options: string[] }) {
  const { viewer, setViewer } = useCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t); }, []);
  if (!mounted) return null;
  return (
    <label className={`inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 font-dm-mono text-[11px] uppercase tracking-widest text-neutral-400 ${className}`}>
      Show prices ≈ in
      <select value={viewer} onChange={(e) => setViewer(e.target.value)} className="bg-transparent text-neutral-200 outline-none">
        {options.map((c) => <option key={c} value={c} className="bg-neutral-900">{c}</option>)}
      </select>
    </label>
  );
}

/** The one-line money note shown near every card checkout button. */
export function ConversionNote({ shopCurrency, className = "" }: { shopCurrency: string; className?: string }) {
  return (
    <p className={`text-[11px] leading-5 text-neutral-500 ${className}`}>
      Prices are in {shopCurrency}. Pay in {shopCurrency} and there is no conversion fee from us (your bank may add its own). At checkout Stripe may offer to charge you in your home currency instead; if you choose that, Stripe adds its conversion charge, usually 2–4%, to your total. The ≈ figures on this page are estimates at today&apos;s rate.
    </p>
  );
}
