"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/utils/money";

type Sale = { id: string; created_at: string; order_ref: string; currency: string; gross_cents: number; shop_cents: number; method: string | null; reference: string | null };
type Data = { sales: Sale[]; totals: Record<string, { gross: number; shop: number; count: number }>; concerns: { ref: string; state: string; amount_cents: number; currency: string; method: string | null; created_at: string }[] };

/**
 * For a shop whose wallet payments go to a coordinator: every sale the
 * coordinator collected for it (last 90 days) with the shop's share, so the
 * shop can check it was paid, and a way to tell NorthEDM directly if not.
 */
export function CoordinatorBook() {
  const [d, setD] = useState<Data | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { fetch("/api/vendor/coordinator-book").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, []);
  async function report() {
    const r = await fetch("/api/vendor/coordinator-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Sent to NorthEDM." : j.error ?? "Failed."); if (r.ok) setNote("");
  }
  if (!d) return null;
  const cur = Object.entries(d.totals);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Money your coordinator collected for you · last 90 days</p>
      <p className="mt-1 text-sm text-neutral-400">Wallet payments for your orders go to your coordinator, who pays you your share. Check each line against what you received.</p>
      {cur.length === 0 ? <p className="mt-3 text-sm text-neutral-600">No wallet sales yet.</p> : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {cur.map(([c, t]) => (
            <div key={c} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">{t.count} sale{t.count === 1 ? "" : "s"} · {c}</p>
              <p className="mt-1 text-white">Your share <span className="font-semibold">{formatMoney(t.shop, c)}</span> <span className="text-neutral-500">of {formatMoney(t.gross, c)} collected</span></p>
            </div>
          ))}
        </div>
      )}
      {d.concerns.length > 0 && (
        <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm">
          <p className="text-yellow-200">Customer payments not confirmed or rejected ({d.concerns.length})</p>
          {d.concerns.map((c) => <p key={c.ref} className="font-dm-mono text-[11px] text-neutral-400">{c.ref} · {formatMoney(c.amount_cents, c.currency)} by {c.method} · {c.state} · {new Date(c.created_at).toLocaleDateString()}</p>)}
          <p className="mt-1 text-xs text-neutral-500">NorthEDM sees these too.</p>
        </div>
      )}
      {d.sales.length > 0 && (
        <button onClick={() => setOpen((o) => !o)} className="mt-3 text-sm text-[#3AFFD4] underline-offset-2 hover:underline">{open ? "Hide sales" : "Show each sale"}</button>
      )}
      {open && (
        <div className="mt-2 space-y-1">
          {d.sales.map((s) => <p key={s.id} className="flex justify-between gap-2 border-b border-white/5 py-1 font-dm-mono text-[11px] text-neutral-400"><span>{new Date(s.created_at).toLocaleDateString()} · {s.order_ref} · {s.method ?? ""}</span><span className="text-neutral-200">you {formatMoney(s.shop_cents, s.currency)} / {formatMoney(s.gross_cents, s.currency)}</span></p>)}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Missing a payment? Say which sale or amount" className="min-w-[14rem] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none" />
        <button onClick={report} disabled={!note.trim()} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-40">Tell NorthEDM</button>
      </div>
      {msg && <p className="mt-2 text-sm text-neutral-300">{msg}</p>}
    </div>
  );
}
