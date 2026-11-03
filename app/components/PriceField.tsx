"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/utils/money";
import { WHOLE_UNIT } from "@/utils/currencies";

/**
 * Price box for the product forms. Prices are stored in the shop's currency
 * (what customers pay). For a non-USD shop the seller can type in USD or in
 * the shop's currency and sees the other figure live, marked ≈ with the day's
 * indicative rate, so a Gambian shop set up in dollars knows the dalasi.
 */
export function PriceField({ value, onChange, currency = "USD", className = "" }: { value: string; onChange: (shopPrice: string) => void; currency?: string; className?: string }) {
  const cur = (currency || "USD").toUpperCase();
  const foreign = cur !== "USD";
  const [mode, setMode] = useState<"shop" | "usd">("shop");
  const [usd, setUsd] = useState("");
  const [fx, setFx] = useState<{ rate: number; date: string | null; fallback?: boolean } | null>(null);
  useEffect(() => {
    if (!foreign) return;
    fetch(`/api/fx?from=USD&to=${cur}`).then((r) => (r.ok ? r.json() : null)).then((j) => j?.rate && setFx({ rate: j.rate, date: j.date, fallback: j.fallback })).catch(() => {});
  }, [cur, foreign]);
  const decimals = WHOLE_UNIT.has(cur) ? 0 : 2;
  const example = fx ? `e.g. ${(12.5 * fx.rate).toFixed(decimals)}` : cur === "GMD" ? "e.g. 935" : "e.g. 12.50";
  const n = Number(value);
  const usdN = Number(usd);
  const shopFromUsd = fx && usdN > 0 ? usdN * fx.rate : null;
  const usdFromShop = fx && n > 0 ? n / fx.rate : null;
  const rateNote = fx ? `1 USD ≈ ${formatMoney(Math.round(fx.rate * 100), cur)} ${fx.fallback ? "(recent rate)" : "today"}` : "fetching rate…";
  const inp = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none";

  if (!foreign) {
    return (
      <div className={className}>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Price in USD (${example})`} inputMode="decimal" className={inp} />
        {n > 0 && <p className="mt-1 font-dm-mono text-[11px] text-neutral-500">Listed as {formatMoney(Math.round(n * 100), "USD")}</p>}
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="flex gap-2">
        {mode === "shop" ? (
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Price in ${cur} (${example})`} inputMode="decimal" className={inp} />
        ) : (
          <input value={usd} onChange={(e) => { setUsd(e.target.value); const v = Number(e.target.value); onChange(fx && v > 0 ? (v * fx.rate).toFixed(decimals) : ""); }} placeholder="Price in USD (e.g. 12.50)" inputMode="decimal" className={inp} />
        )}
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-white/10 text-xs">
          <button type="button" onClick={() => setMode("shop")} className={`px-3 ${mode === "shop" ? "bg-white/15 text-white" : "text-neutral-400"}`}>{cur}</button>
          <button type="button" onClick={() => setMode("usd")} className={`px-3 ${mode === "usd" ? "bg-white/15 text-white" : "text-neutral-400"}`}>USD</button>
        </div>
      </div>
      <p className="mt-1 font-dm-mono text-[11px] text-neutral-400">
        {mode === "usd"
          ? shopFromUsd ? <>≈ <span className="text-white">{formatMoney(Math.round(shopFromUsd * 100), cur)}</span> — this is the price customers see and pay · {rateNote}</> : <>Type a dollar amount to see the {cur} price · {rateNote}</>
          : usdFromShop ? <>≈ <span className="text-white">{formatMoney(Math.round(usdFromShop * 100), "USD")}</span> · {rateNote}</> : <>Customers pay in {cur} · {rateNote}</>}
      </p>
    </div>
  );
}
