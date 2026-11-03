"use client";
import { useEffect, useState } from "react";

type Minted = { id: string; code: string; percent_off: number | null; amount_off_cents: number | null; times_redeemed: number; active: boolean; note: string | null; created_at: string; last_redeemed_at: string | null };

/** Promoter: mint one-time discount codes for shops you're bringing on. */
export function MintCodes() {
  const [data, setData] = useState<{ codes: Minted[]; max_percent_off: number; max_amount_off_cents: number } | null>(null);
  const [pct, setPct] = useState(""); const [amt, setAmt] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [copied, setCopied] = useState<string | null>(null);
  const load = () => fetch("/api/promote/mint").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setData(j); }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return null;
  async function mint() {
    setBusy(true); setErr("");
    const r = await fetch("/api/promote/mint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ percentOff: pct, amountOff: amt, note }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Couldn't mint."); return; }
    setPct(""); setAmt(""); setNote(""); load();
  }
  const link = (c: string) => `${window.location.origin}/vendors/apply?code=${encodeURIComponent(c)}`;
  const off = (c: Minted) => c.percent_off != null ? `${c.percent_off}% off` : `$${((c.amount_off_cents ?? 0) / 100).toFixed(2)} off`;
  return (
    <div className="mb-8 rounded-2xl border border-orange-500/30 bg-orange-950/20 p-5">
      <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-400">Bring a shop on · one-time codes</p>
      <p className="mt-1 text-sm text-neutral-400">Mint a code and hand it to a shop you want on NorthEDM. It takes the amount you choose off their first month (FestDash listing, store, or the bundle), works once, and marks the shop as yours: you earn your share of their fees and sales. Up to {data.max_percent_off}% or ${(data.max_amount_off_cents / 100).toFixed(0)} off.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
        <input value={pct} onChange={(e) => { setPct(e.target.value); setAmt(""); }} placeholder="% off" inputMode="numeric" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none" />
        <input value={amt} onChange={(e) => { setAmt(e.target.value); setPct(""); }} placeholder="or $ off" inputMode="decimal" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who it's for (optional)" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none" />
        <button onClick={mint} disabled={busy || (!pct && !amt)} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">{busy ? "Minting…" : "Mint code"}</button>
      </div>
      {err && <p className="mt-2 text-xs text-[#FF5C3A]">{err}</p>}
      {data.codes.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {data.codes.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
              <span className="font-dm-mono text-white">{c.code} <span className="text-neutral-400">· {off(c)}</span>{c.note ? <span className="text-neutral-500"> · {c.note}</span> : null}</span>
              {c.times_redeemed > 0 ? <span className="font-dm-mono text-[11px] uppercase text-green-400">used</span> : (
                <button onClick={() => { navigator.clipboard.writeText(link(c.code)); setCopied(c.id); setTimeout(() => setCopied(null), 1500); }} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-neutral-200 hover:bg-white/5">{copied === c.id ? "Copied ✓" : "Copy apply link"}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
