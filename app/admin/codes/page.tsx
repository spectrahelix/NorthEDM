"use client";
import { useEffect, useState } from "react";
import { BackBar } from "@/app/components/BackBar";

type Row = { id: string; code: string; percent_off: number | null; amount_off_cents: number | null; max_redemptions: number | null; times_redeemed: number; active: boolean; expires_at: string | null; minted_by: string | null; minted_by_name: string | null; note: string | null; created_at: string; last_redeemed_at: string | null };
const input = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none";

export default function AdminCodesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState({ code: "", percentOff: "", amountOff: "", oneTime: true, maxRedemptions: "", expiresAt: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function load() {
    const r = await fetch("/api/admin/codes");
    if (r.status === 401 || r.status === 403) { setForbidden(true); return; }
    const j = await r.json(); setRows(j.codes ?? []);
  }
  useEffect(() => { load(); }, []);
  async function create() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Couldn't create."); return; }
    setForm({ code: "", percentOff: "", amountOff: "", oneTime: true, maxRedemptions: "", expiresAt: "", note: "" }); setMsg(`Created ${j.code.code}.`); load();
  }
  async function toggle(row: Row) {
    await fetch("/api/admin/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id: row.id, active: !row.active }) });
    load();
  }
  if (forbidden) return <main className="flex min-h-screen items-center justify-center text-neutral-400">Forbidden.</main>;
  const off = (r: Row) => r.percent_off != null ? `${r.percent_off}% off` : `$${((r.amount_off_cents ?? 0) / 100).toFixed(2)} off`;
  return (
    <main className="min-h-screen px-6 py-14 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <BackBar fallback="/admin" />
        <p className="mt-4 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#E8FF47]">Admin · Discount codes</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-wide">Codes</h1>
        <p className="mt-2 text-sm text-neutral-400">Typed at a subscription checkout (FestDash listing, store, or the bundle) or on an application. One-time codes work for one order and apply to the first month; unlimited codes apply every month. A promoter&apos;s own referral code always works and isn&apos;t listed here; codes promoters mint for shops they bring on are.</p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">New code</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input className={input + " font-dm-mono uppercase"} placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <input className={input} placeholder="% off (e.g. 20)" inputMode="numeric" value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value, amountOff: "" })} />
            <input className={input} placeholder="or $ off (e.g. 10)" inputMode="decimal" value={form.amountOff} onChange={(e) => setForm({ ...form, amountOff: e.target.value, percentOff: "" })} />
            <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" checked={form.oneTime} onChange={(e) => setForm({ ...form, oneTime: e.target.checked })} /> One-time (one order, first month)</label>
            {!form.oneTime && <input className={input} placeholder="Max uses (blank = unlimited)" inputMode="numeric" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />}
            <input className={input} type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} title="Expires (optional)" />
            <input className={input + " sm:col-span-3"} placeholder="Note (who it's for)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={create} disabled={busy} className="rounded-xl bg-[#39FF14] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Creating…" : "Create code"}</button>
            {msg && <span className="text-sm text-neutral-400">{msg}</span>}
          </div>
        </div>

        <div className="mt-8 space-y-2">
          {rows === null ? <p className="font-dm-mono text-sm text-neutral-500">Loading…</p> : rows.length === 0 ? <p className="text-sm text-neutral-500">No codes yet.</p> : rows.map((r) => (
            <div key={r.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${r.active ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-60"}`}>
              <div className="min-w-0">
                <p className="font-dm-mono text-sm text-white">{r.code} <span className="text-neutral-400">· {off(r)}</span> <span className="text-neutral-500">· {r.max_redemptions === 1 ? "one-time" : r.max_redemptions ? `${r.times_redeemed}/${r.max_redemptions} used` : `unlimited · used ${r.times_redeemed}×`}</span></p>
                <p className="text-xs text-neutral-500">
                  {r.minted_by ? `Minted by ${r.minted_by_name}` : "Owner code"}{r.note ? ` · ${r.note}` : ""}{r.expires_at ? ` · expires ${new Date(r.expires_at).toLocaleDateString()}` : ""}{r.max_redemptions === 1 && r.times_redeemed > 0 ? ` · used ${r.last_redeemed_at ? new Date(r.last_redeemed_at).toLocaleDateString() : ""}` : ""}
                </p>
              </div>
              <button onClick={() => toggle(r)} className="rounded-lg border border-white/15 px-3 py-1 text-xs text-neutral-300 hover:bg-white/5">{r.active ? "Switch off" : "Switch on"}</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
