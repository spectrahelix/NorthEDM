"use client";

import { useEffect, useState } from "react";

type Store = {
  id: string; slug: string; name: string; tagline: string | null;
  owner_email: string | null; accent_color: string; operator_fee_bps: number; active: boolean;
};

export default function AdminStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [tagline, setTagline] = useState("");
  const [feePct, setFeePct] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/admin/stores");
    if (res.status === 401 || res.status === 403) { setForbidden(true); setLoading(false); return; }
    const j = await res.json().catch(() => ({}));
    setStores(j.stores ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const res = await fetch("/api/admin/stores", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, name, ownerEmail, tagline, operatorFeeBps: Math.round((Number(feePct) || 0) * 100) }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error || "Failed."); return; }
    setMsg(`Created — live at ${j.url}`);
    setSlug(""); setName(""); setOwnerEmail(""); setTagline(""); setFeePct("");
    load();
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center admin-surface"><p className="font-dm-mono text-sm text-neutral-500">Loading…</p></main>;
  if (forbidden) return <main className="flex min-h-screen items-center justify-center admin-surface text-neutral-400">Forbidden.</main>;

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-3xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#FFC93C]">Admin · Stores</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Embedded Stores</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Give a partner their own branded multi-vendor storefront at <span className="text-neutral-300">northedm.com/&lt;slug&gt;</span>.
          They manage it as operator; you stay host admin. (Payout split is Phase 2.)
        </p>

        <form onSubmit={create} className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">New store</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Store name *" required
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:outline-none" />
            <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-3">
              <span className="font-dm-mono text-xs text-neutral-500">/</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="slug *" required
                className="w-full bg-transparent px-1 py-2.5 text-sm focus:outline-none" />
            </div>
            <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="Operator email *" type="email" required
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:outline-none" />
            <input value={feePct} onChange={(e) => setFeePct(e.target.value)} inputMode="decimal" placeholder="Operator fee % (Phase 2)"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:outline-none" />
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline (optional)"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:outline-none sm:col-span-2" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={busy}
              className="rounded-xl bg-[#FFC93C] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
              {busy ? "Creating…" : "Create store"}
            </button>
            {msg && <span className="font-dm-mono text-xs text-neutral-400">{msg}</span>}
          </div>
        </form>

        <h2 className="mt-10 mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Stores ({stores.length})</h2>
        {stores.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">No stores yet.</p>
        ) : (
          <div className="space-y-2">
            {stores.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.accent_color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{s.name} <span className="ml-1 font-dm-mono text-xs text-neutral-500">/{s.slug}</span></p>
                  <p className="font-dm-mono text-xs text-neutral-500">operator: {s.owner_email || "—"} · fee {(s.operator_fee_bps / 100)}%</p>
                </div>
                <a href={`/${s.slug}`} target="_blank" rel="noopener noreferrer" className="font-dm-mono text-xs text-[#3AFFD4] hover:underline">storefront ↗</a>
                <a href={`/${s.slug}/manage`} target="_blank" rel="noopener noreferrer" className="font-dm-mono text-xs text-neutral-400 hover:underline">manage ↗</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
