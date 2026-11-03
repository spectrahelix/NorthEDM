"use client";
import { useEffect, useMemo, useState } from "react";
import { BackBar } from "@/app/components/BackBar";

type Row = { id: string; code: string; percent_off: number | null; amount_off_cents: number | null; max_redemptions: number | null; times_redeemed: number; active: boolean; expires_at: string | null; minted_by: string | null; minted_by_name: string | null; assigned_to: string | null; assigned_to_name: string | null; assigned_at: string | null; sent_at: string | null; note: string | null; created_at: string; last_redeemed_at: string | null; used: boolean };
type Member = { id: string; display_name: string; username: string | null; email: string; role: string };
const TIERS = [20, 25, 30, 50];
const input = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none";

export default function AdminCodesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pool, setPool] = useState<Record<string, number>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Member | null>(null);
  const [tier, setTier] = useState(20);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({ code: "", percentOff: "", amountOff: "", oneTime: true, maxRedemptions: "", expiresAt: "", note: "" });

  async function load() {
    const r = await fetch("/api/admin/codes");
    if (r.status === 401 || r.status === 403) { setForbidden(true); return; }
    const j = await r.json(); setRows(j.codes ?? []); setPool(j.pool ?? {});
  }
  useEffect(() => {
    load();
    fetch("/api/admin/get-users").then((r) => (r.ok ? r.json() : { users: [] })).then((j) => setMembers(j.users ?? [])).catch(() => {});
  }, []);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return members.filter((m) => (m.display_name ?? "").toLowerCase().includes(s) || (m.username ?? "").toLowerCase().includes(s) || (m.email ?? "").toLowerCase().includes(s)).slice(0, 8);
  }, [q, members]);

  async function post(payload: Record<string, unknown>, key: string, ok: (j: Record<string, unknown>) => string) {
    setBusy(key); setMsg("");
    const r = await fetch("/api/admin/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg(j.error ?? "Failed."); return; }
    setMsg(ok(j)); load();
  }
  if (forbidden) return <main className="flex min-h-screen items-center justify-center text-neutral-400">Forbidden.</main>;

  const off = (r: Row) => r.percent_off != null ? `${r.percent_off}% off` : `$${((r.amount_off_cents ?? 0) / 100).toFixed(2)} off`;
  const all = rows ?? [];
  const sentUnused = all.filter((r) => r.assigned_to && !r.used && r.active);
  const promoterMinted = all.filter((r) => r.minted_by && !r.used && r.active);
  const custom = all.filter((r) => !r.minted_by && r.max_redemptions !== 1 && r.active);
  const history = all.filter((r) => r.used || !r.active);

  return (
    <main className="min-h-screen px-6 py-14 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <BackBar fallback="/admin" />
        <p className="mt-4 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#E8FF47]">Admin · Discounts &amp; vouchers</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-wide">Discounts &amp; Vouchers</h1>
        <p className="mt-2 text-sm text-neutral-400">A voucher is a one-time code for a percentage off a member&apos;s first month of any plan (FestDash listing, store, or the bundle). Send one and it&apos;s emailed to them and saved on their profile; once used it disappears from here and from their profile.</p>
        {msg && <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-neutral-200">{msg}</p>}

        {/* Pool */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Your voucher pool</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIERS.map((t) => (
              <div key={t} className="rounded-xl bg-white/5 p-3 text-center">
                <p className="font-bebas text-3xl text-[#E8FF47]">{pool[t] ?? 0}</p>
                <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-400">{t}% off left</p>
                <button onClick={() => post({ action: "mint_batch", percentOff: t, count: 10 }, `mint${t}`, (j) => `Minted ${j.minted} × ${t}% vouchers.`)} disabled={!!busy} className="mt-2 rounded-lg border border-white/15 px-2 py-1 text-[11px] text-neutral-200 hover:bg-white/5 disabled:opacity-50">{busy === `mint${t}` ? "…" : "+10"}</button>
              </div>
            ))}
          </div>
        </div>

        {/* Send */}
        <div className="mt-4 rounded-2xl border border-[#39FF14]/30 bg-[#39FF14]/[0.04] p-5">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-[#39FF14]">Send a voucher to a member</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <input className={input} placeholder="Search by name, @username or email" value={picked ? `${picked.display_name} · ${picked.email}` : q} onChange={(e) => { setPicked(null); setQ(e.target.value); }} />
              {!picked && hits.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-neutral-950 shadow-xl">
                  {hits.map((m) => (
                    <button key={m.id} onClick={() => { setPicked(m); setQ(""); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5">
                      <span className="text-white">{m.display_name}</span>{m.username ? <span className="text-neutral-500"> @{m.username}</span> : null}<span className="block text-xs text-neutral-500">{m.email} · {m.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className={input + " sm:w-36"}>
              {TIERS.map((t) => <option key={t} value={t}>{t}% off</option>)}
            </select>
            <button onClick={() => picked && post({ action: "send", userId: picked.id, percentOff: tier }, "send", (j) => `Sent ${j.code} (${tier}%) to ${picked.display_name}${j.emailed ? " by email and to their profile." : ` — saved to their profile, but the email failed: ${j.email_error}.`}`)} disabled={!picked || !!busy} className="rounded-xl bg-[#39FF14] px-5 py-2 text-sm font-semibold text-black disabled:opacity-40">{busy === "send" ? "Sending…" : "Send voucher"}</button>
          </div>
        </div>

        {/* Sent, unused */}
        <Section title={`Sent, not yet used (${sentUnused.length})`}>
          {sentUnused.length === 0 ? <Empty>None outstanding.</Empty> : sentUnused.map((r) => (
            <Line key={r.id} r={r} off={off} right={`to ${r.assigned_to_name ?? "member"} · ${r.sent_at ? "emailed" : "email failed"} ${r.assigned_at ? new Date(r.assigned_at).toLocaleDateString() : ""}`} onToggle={() => post({ action: "toggle", id: r.id, active: false }, r.id, () => "Switched off.")} />
          ))}
        </Section>

        {/* Promoter-minted */}
        <Section title={`Minted by promoters, not yet used (${promoterMinted.length})`}>
          {promoterMinted.length === 0 ? <Empty>No live promoter codes.</Empty> : promoterMinted.map((r) => (
            <Line key={r.id} r={r} off={off} right={`minted by ${r.minted_by_name}${r.note ? ` · ${r.note}` : ""}`} onToggle={() => post({ action: "toggle", id: r.id, active: false }, r.id, () => "Switched off.")} />
          ))}
        </Section>

        {/* Custom / reusable codes */}
        <Section title={`Reusable codes (${custom.length})`} action={<button onClick={() => setShowCustom((v) => !v)} className="text-xs text-[#3AFFD4]">{showCustom ? "Hide form" : "New code"}</button>}>
          {showCustom && (
            <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <input className={input + " font-dm-mono uppercase"} placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                <input className={input} placeholder="% off" inputMode="numeric" value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value, amountOff: "" })} />
                <input className={input} placeholder="or $ off" inputMode="decimal" value={form.amountOff} onChange={(e) => setForm({ ...form, amountOff: e.target.value, percentOff: "" })} />
                <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" checked={form.oneTime} onChange={(e) => setForm({ ...form, oneTime: e.target.checked })} /> One-time</label>
                {!form.oneTime && <input className={input} placeholder="Max uses (blank = unlimited)" inputMode="numeric" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />}
                <input className={input} type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                <input className={input + " sm:col-span-3"} placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <button onClick={() => post(form, "custom", (j) => `Created ${(j.code as { code: string }).code}.`)} disabled={!!busy} className="mt-3 rounded-xl bg-[#39FF14] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Create code</button>
            </div>
          )}
          {custom.length === 0 ? <Empty>None.</Empty> : custom.map((r) => (
            <Line key={r.id} r={r} off={off} right={r.max_redemptions ? `${r.times_redeemed}/${r.max_redemptions} used` : `unlimited · used ${r.times_redeemed}×`} onToggle={() => post({ action: "toggle", id: r.id, active: false }, r.id, () => "Switched off.")} />
          ))}
        </Section>

        <Section title={`History — used or switched off (${history.length})`} action={<button onClick={() => setShowHistory((v) => !v)} className="text-xs text-[#3AFFD4]">{showHistory ? "Hide" : "Show"}</button>}>
          {showHistory && (history.length === 0 ? <Empty>Nothing yet.</Empty> : history.map((r) => (
            <Line key={r.id} r={r} off={off} dim right={`${r.used ? `used ${r.last_redeemed_at ? new Date(r.last_redeemed_at).toLocaleDateString() : ""}` : "switched off"}${r.assigned_to_name ? ` · ${r.assigned_to_name}` : ""}${r.minted_by_name ? ` · minted by ${r.minted_by_name}` : ""}`} onToggle={!r.active && !r.used ? () => post({ action: "toggle", id: r.id, active: true }, r.id, () => "Switched on.") : undefined} toggleLabel="Switch on" />
          )))}
        </Section>
      </div>
    </main>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between"><p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{title}</p>{action}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-sm text-neutral-600">{children}</p>; }
function Line({ r, off, right, onToggle, toggleLabel = "Switch off", dim }: { r: Row; off: (r: Row) => string; right: string; onToggle?: () => void; toggleLabel?: string; dim?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 ${dim ? "opacity-60" : ""}`}>
      <p className="font-dm-mono text-sm text-white">{r.code} <span className="text-neutral-400">· {off(r)}</span> <span className="text-neutral-500">· {right}</span></p>
      {onToggle && <button onClick={onToggle} className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-white/5">{toggleLabel}</button>}
    </div>
  );
}
