"use client";

import { useEffect, useState } from "react";

type Promoter = { user_id: string; display_name: string | null };
type Hoodie = {
  id: string;
  code: string;
  promoter_user_id: string;
  promoter_name: string;
  label: string | null;
  percent_off: number;
  active: boolean;
  scans: number;
  redemptions: number;
  earned_cents: number;
  created_at: string;
};

export default function AdminHoodiesPage() {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [hoodies, setHoodies] = useState<Hoodie[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const [promoter, setPromoter] = useState("");
  const [percent, setPercent] = useState("10");
  const [qty, setQty] = useState("10");
  const [labelPrefix, setLabelPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/admin/hoodies");
    if (res.status === 403 || res.status === 401) { setForbidden(true); setLoading(false); return; }
    const j = await res.json().catch(() => ({}));
    setPromoters(j.promoters ?? []);
    setHoodies(j.hoodies ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function mint(e: React.FormEvent) {
    e.preventDefault();
    if (!promoter) { setMsg("Pick a promoter."); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/admin/hoodies", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mint", promoterUserId: promoter, percentOff: Number(percent), quantity: Number(qty), labelPrefix }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error || "Mint failed."); return; }
    setMsg(`Minted ${j.created?.length ?? 0} hoodie codes.`);
    load();
  }

  async function post(body: Record<string, unknown>) {
    await fetch("/api/admin/hoodies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    load();
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center admin-surface"><p className="font-dm-mono text-sm text-neutral-500">Loading…</p></main>;
  if (forbidden) return <main className="flex min-h-screen items-center justify-center admin-surface text-neutral-400">Forbidden.</main>;

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#CC00FF]">Admin · Promoter Hoodies</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Bright Future Hoodie Line</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Mint unique hoodie codes for a promoter, download each print-ready QR for Bright Future,
          and track scans, redemptions, and promoter earnings. Each QR points to
          <span className="text-neutral-300"> /h/&lt;code&gt;</span>; scanning applies the promoter&apos;s
          discount and credits them what the customer saves.
        </p>

        {/* Mint */}
        <form onSubmit={mint} className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Mint hoodies</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <select value={promoter} onChange={(e) => setPromoter(e.target.value)}
              className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm">
              <option value="">Select a promoter…</option>
              {promoters.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0, 8)}</option>)}
            </select>
            <input value={labelPrefix} onChange={(e) => setLabelPrefix(e.target.value)} placeholder="Label prefix (optional, e.g. 'Drop 1')"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm placeholder:text-neutral-600 focus:outline-none" />
            <input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="numeric" placeholder="Discount %"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm placeholder:text-neutral-600 focus:outline-none" />
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="How many hoodies"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm placeholder:text-neutral-600 focus:outline-none" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={busy}
              className="rounded-xl bg-[#CC00FF] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {busy ? "Minting…" : "Mint codes"}
            </button>
            {msg && <span className="font-dm-mono text-xs text-neutral-400">{msg}</span>}
          </div>
        </form>

        {/* List */}
        <h2 className="mt-10 mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Hoodies ({hoodies.length})</h2>
        {hoodies.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">No hoodies minted yet.</p>
        ) : (
          <div className="space-y-2">
            {hoodies.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-dm-mono text-sm text-white">
                    {h.code}
                    <span className="ml-2 text-neutral-500">· {h.promoter_name}</span>
                    {h.label ? <span className="ml-2 text-neutral-600">· {h.label}</span> : null}
                  </p>
                  <p className="mt-0.5 font-dm-mono text-xs text-neutral-500">
                    {h.percent_off}% off · {h.scans} scans · {h.redemptions} orders · earned ${(h.earned_cents / 100).toFixed(2)}
                  </p>
                </div>
                <a href={`/h/${h.code}`} target="_blank" rel="noopener noreferrer"
                  className="font-dm-mono text-xs text-[#3AFFD4] hover:underline">landing ↗</a>
                <a href={`/api/admin/hoodies/qr?code=${encodeURIComponent(h.code)}&download=1`}
                  className="rounded-lg border border-white/10 px-3 py-1.5 font-dm-mono text-xs text-neutral-300 transition hover:bg-white/5">
                  Download QR
                </a>
                <button onClick={() => post({ action: "toggle", id: h.id, active: !h.active })}
                  className={`rounded-lg px-3 py-1.5 font-dm-mono text-xs transition ${h.active ? "bg-[#39FF14]/15 text-[#39FF14] hover:bg-[#39FF14]/25" : "bg-white/5 text-neutral-500 hover:bg-white/10"}`}>
                  {h.active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
