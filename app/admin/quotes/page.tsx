"use client";

import { useEffect, useState } from "react";

type Promoter = { user_id: string; display_name: string | null };
type Quote = {
  id: string; token: string; title: string; client_name: string | null; client_email: string | null;
  total_cents: number; deposit_cents: number; monthly_cents: number; promoter_user_id: string | null;
  promoter_name: string | null; commission_bps: number; status: string; amount_paid_cents: number; promoter_paid_cents: number;
};
type Row = { label: string; dollars: string };

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminQuotesPage() {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [rows, setRows] = useState<Row[]>([{ label: "Website design & development", dollars: "500" }]);
  const [depositPct, setDepositPct] = useState("50");
  const [monthly, setMonthly] = useState("");
  const [promoter, setPromoter] = useState("");
  const [commission, setCommission] = useState("10");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ payUrl: string } | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/admin/quotes");
    if (res.status === 403 || res.status === 401) { setForbidden(true); setLoading(false); return; }
    const j = await res.json().catch(() => ({}));
    setPromoters(j.promoters ?? []);
    setQuotes(j.quotes ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const totalCents = rows.reduce((s, r) => s + Math.round((Number(r.dollars) || 0) * 100), 0);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(""); setMade(null);
    const lineItems = rows
      .map((r) => ({ label: r.label.trim(), amount_cents: Math.round((Number(r.dollars) || 0) * 100) }))
      .filter((r) => r.label && r.amount_cents > 0);
    const depositCents = Math.round((totalCents * (Number(depositPct) || 0)) / 100);
    const res = await fetch("/api/admin/quotes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title, clientName, clientEmail, lineItems, depositCents,
        monthlyCents: Math.round((Number(monthly) || 0) * 100),
        promoterUserId: promoter || null, commissionBps: Math.round((Number(commission) || 0) * 100),
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error || "Failed."); return; }
    setMade({ payUrl: j.payUrl });
    setTitle(""); setClientName(""); setClientEmail(""); setRows([{ label: "", dollars: "" }]);
    load();
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center admin-surface"><p className="font-dm-mono text-sm text-neutral-500">Loading…</p></main>;
  if (forbidden) return <main className="flex min-h-screen items-center justify-center admin-surface text-neutral-400">Forbidden.</main>;

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-3xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#39FF14]">Admin · Quotes</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Service Quotes</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Build a quote, send the pay link, collect via Stripe. If you assign a promoter, they&apos;re
          paid their cash commission automatically when the quote is paid in full (they must have
          connected payouts).
        </p>

        <form onSubmit={create} className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">New quote</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quote title (e.g. Frank's Store Website)" required
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm placeholder:text-neutral-600 focus:outline-none sm:col-span-2" />
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm placeholder:text-neutral-600 focus:outline-none" />
            <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Client email" type="email"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm placeholder:text-neutral-600 focus:outline-none" />
          </div>

          {/* Line items */}
          <p className="mb-2 mt-5 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Line items</p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input value={r.label} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  placeholder="Description" className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm placeholder:text-neutral-600 focus:outline-none" />
                <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-3">
                  <span className="text-neutral-500">$</span>
                  <input value={r.dollars} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, dollars: e.target.value } : x))}
                    inputMode="decimal" placeholder="0" className="w-20 bg-transparent px-1 py-2.5 text-sm focus:outline-none" />
                </div>
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    className="rounded-xl border border-white/10 px-3 text-neutral-500 hover:text-[#FF5C3A]">×</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setRows([...rows, { label: "", dollars: "" }])}
            className="mt-2 font-dm-mono text-xs text-[#39FF14] hover:underline">+ add line</button>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Total</span>
            <span className="font-bebas text-2xl text-[#39FF14]">{money(totalCents)}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-neutral-500">Deposit %
              <input value={depositPct} onChange={(e) => setDepositPct(e.target.value)} inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 focus:outline-none" />
            </label>
            <label className="text-xs text-neutral-500">Monthly maintenance ($/mo, optional)
              <input value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" placeholder="0"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
            </label>
            <label className="text-xs text-neutral-500">Referring promoter (optional)
              <select value={promoter} onChange={(e) => setPromoter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm focus:outline-none">
                <option value="">None</option>
                {promoters.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0, 8)}</option>)}
              </select>
            </label>
            <label className="text-xs text-neutral-500">Commission %
              <input value={commission} onChange={(e) => setCommission(e.target.value)} inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 focus:outline-none" />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={busy}
              className="rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
              {busy ? "Creating…" : "Create quote"}
            </button>
            {msg && <span className="font-dm-mono text-xs text-[#FF5C3A]">{msg}</span>}
          </div>
          {made && (
            <div className="mt-4 rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/[0.06] p-4">
              <p className="font-dm-mono text-xs text-neutral-400">Pay link — send this to the client:</p>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly value={made.payUrl} className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-dm-mono text-xs text-[#39FF14]" />
                <button type="button" onClick={() => navigator.clipboard.writeText(made.payUrl)}
                  className="rounded-lg bg-[#39FF14] px-3 py-2 font-dm-mono text-xs font-bold text-black">Copy</button>
              </div>
            </div>
          )}
        </form>

        <h2 className="mt-10 mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Quotes ({quotes.length})</h2>
        {quotes.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">No quotes yet.</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <div key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{q.title} <span className="ml-2 font-dm-mono text-xs text-neutral-500">{money(q.total_cents)}</span></p>
                  <p className="font-dm-mono text-xs text-neutral-500">
                    {q.client_name || "—"} · {money(q.amount_paid_cents)} paid
                    {q.promoter_name ? ` · promoter: ${q.promoter_name} (${(q.commission_bps / 100)}%${q.promoter_paid_cents ? ` — paid ${money(q.promoter_paid_cents)}` : " — owed"})` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest ${q.status === "paid" ? "bg-[#39FF14]/15 text-[#39FF14]" : q.status === "deposit_paid" ? "bg-[#E8FF47]/15 text-[#E8FF47]" : "bg-white/5 text-neutral-500"}`}>{q.status.replace("_", " ")}</span>
                <a href={`/quote/${q.token}`} target="_blank" rel="noopener noreferrer" className="font-dm-mono text-xs text-[#3AFFD4] hover:underline">pay link ↗</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
