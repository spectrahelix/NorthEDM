"use client";
import { useEffect, useState } from "react";
import { COUNTRIES } from "@/utils/shipping";
import { formatMoney } from "@/utils/money";

export type ShipChoice = { country: string; service: string | null };
type Opt = { id: string; name: string; cents: number; eta: string };

/**
 * "Ship to" for a cart: destination country + the shipping services quoted
 * for this cart's weight, with price and estimated transit. The server
 * re-quotes at checkout, so nothing chosen here is trusted for money.
 */
export function ShipTo({ kind, items, value, onChange, currency = "USD", accent = "#39FF14" }: {
  kind: "shop" | "store"; items: { id: string | number; qty: number }[]; value: ShipChoice; onChange: (v: ShipChoice, cents: number) => void; currency?: string; accent?: string;
}) {
  const [opts, setOpts] = useState<Opt[] | null>(null);
  const [zone, setZone] = useState("");
  const [err, setErr] = useState("");
  const key = JSON.stringify(items);
  useEffect(() => {
    let live = true;
    const apply = (o: Opt[] | null, e: string, z: string) => { if (!live) return; setOpts(o); setErr(e); setZone(z); };
    if (!items.length) { Promise.resolve().then(() => apply(null, "", "")); return () => { live = false; }; }
    fetch("/api/shipping/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, items, country: value.country }) })
      .then(async (r) => { const j = await r.json(); if (!r.ok) { apply([], j.error ?? "No shipping quote.", ""); return; } apply(j.options ?? [], "", j.zone_label ?? ""); })
      .catch(() => apply([], "No shipping quote.", ""));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value.country, kind]);
  // Pick the cheapest option automatically when the list changes or the current one disappears.
  useEffect(() => {
    if (!opts || !opts.length) { if (opts && value.service) onChange({ ...value, service: null }, 0); return; }
    const cur = opts.find((o) => o.id === value.service);
    if (!cur) onChange({ ...value, service: opts[0].id }, opts[0].cents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Ship to</span>
        <select value={value.country} onChange={(e) => onChange({ country: e.target.value, service: null }, 0)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none">
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </label>
      {err && <p className="text-xs text-[#FF5C3A]">{err}</p>}
      {opts && opts.length > 0 && (
        <div className="space-y-1.5">
          {opts.map((o) => (
            <button type="button" key={o.id} onClick={() => onChange({ ...value, service: o.id }, o.cents)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${value.service === o.id ? "border-white/60 bg-white/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"}`}>
              <span><span className="font-medium">{o.name}</span><span className="block text-xs text-neutral-500">Est. {o.eta}{zone ? ` · ${zone}` : ""}</span></span>
              <span className="font-dm-mono text-sm" style={{ color: accent }}>{formatMoney(o.cents, currency)}</span>
            </button>
          ))}
          <p className="text-[11px] text-neutral-600">Shipping prices and times are estimates. Duties or import fees at the destination are the recipient&apos;s responsibility.</p>
        </div>
      )}
    </div>
  );
}
