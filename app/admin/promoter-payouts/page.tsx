"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  promoter_name: string | null;
  source_type: string;
  source_id: string;
  base_cents: number;
  amount_cents: number;
  status: string;
  payable_after: string | null;
  released_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  hold_days: number;
  created_at: string;
  payout_method: string;
  payout_ready: boolean;
};
type Reserve = {
  held_cents: number; held_count: number;
  releasable_cents: number; releasable_count: number;
  paid_cents: number; reversed_cents: number;
};

const money = (c: number) => `$${((c ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS: Record<string, string> = {
  held: "bg-[#E8FF47]/15 text-[#E8FF47]",
  paid: "bg-[#39FF14]/15 text-[#39FF14]",
  reversed: "bg-white/5 text-neutral-500",
  failed: "bg-[#FF5C3A]/15 text-[#FF5C3A]",
};

export default function PromoterPayoutsPage() {
  const [reserve, setReserve] = useState<Reserve | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/commissions");
    if (res.status === 401 || res.status === 403) { setForbidden(true); setLoading(false); return; }
    const j = await res.json().catch(() => ({}));
    setReserve(j.reserve ?? null);
    setRows(j.commissions ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function release(id: string) {
    setBusy(id); setError("");
    const res = await fetch("/api/admin/commissions", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(j.error || "Couldn't release."); return; }
    load();
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center admin-surface"><p className="font-dm-mono text-sm text-neutral-500">Loading…</p></main>;
  if (forbidden) return <main className="flex min-h-screen items-center justify-center admin-surface text-neutral-400">Forbidden.</main>;

  const now = Date.now();

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#E8FF47]">Admin · Promoter Payouts</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Commissions Owed</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          What NorthEDM owes promoters. Commissions are <span className="text-neutral-300">held</span> for a
          refund-protection window and released automatically once it closes — nothing is paid during the
          window, so a refund voids it instead of needing a clawback.
        </p>

        {/* The reserve — money in your Stripe balance that isn't yours to spend. */}
        <div className="mt-6 rounded-2xl border border-[#E8FF47]/25 bg-[#E8FF47]/[0.05] p-5">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-[#E8FF47]">⚠️ Reserved for promoters — do not spend</p>
          <p className="mt-2 font-bebas text-4xl text-[#E8FF47]">{money(reserve?.held_cents ?? 0)}</p>
          <p className="mt-1 text-sm text-neutral-400">
            {reserve?.held_count ?? 0} commission{(reserve?.held_count ?? 0) === 1 ? "" : "s"} awaiting release.
            This sits in your Stripe balance but is owed out — treat it as already spent.
          </p>
          {(reserve?.releasable_count ?? 0) > 0 && (
            <p className="mt-2 font-dm-mono text-xs text-[#39FF14]">
              {money(reserve!.releasable_cents)} ({reserve!.releasable_count}) past its window — the daily job will pay these out.
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Paid out</p>
            <p className="mt-1 font-bebas text-2xl text-[#39FF14]">{money(reserve?.paid_cents ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Voided (refunds)</p>
            <p className="mt-1 font-bebas text-2xl text-neutral-400">{money(reserve?.reversed_cents ?? 0)}</p>
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-[#FF5C3A]/10 px-3 py-2 text-sm text-[#FF5C3A]">{error}</p>}

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">
              No commissions yet. They appear here once a promoter&apos;s code is used on a paid sale.
            </p>
          ) : rows.map((r) => {
            const due = r.payable_after ? new Date(r.payable_after) : null;
            const ready = r.status === "held" && due !== null && due.getTime() <= now;
            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bebas text-2xl tracking-wide">
                      {money(r.amount_cents)}
                      <span className="ml-2 font-dm-mono text-xs text-neutral-500">
                        to {r.promoter_name || "promoter"} · {r.source_type.replace("_", " ")}
                      </span>
                    </p>
                    <p className="mt-1 font-dm-mono text-[11px] text-neutral-500">
                      on {money(r.base_cents)} · {new Date(r.created_at).toLocaleDateString()} · via {r.payout_method}
                    </p>
                    {r.status === "held" && due && (
                      <p className={`mt-1 font-dm-mono text-[11px] ${ready ? "text-[#39FF14]" : "text-neutral-400"}`}>
                        {ready
                          ? "✅ protection window closed — ready to pay"
                          : `🔒 protected until ${due.toLocaleDateString()} (${r.hold_days}-day window)`}
                      </p>
                    )}
                    {r.status === "held" && !r.payout_ready && (
                      <p className="mt-1 font-dm-mono text-[11px] text-[#FF5C3A]">
                        promoter hasn&apos;t connected a payout account yet
                      </p>
                    )}
                    {r.reversal_reason && (
                      <p className="mt-1 font-dm-mono text-[11px] text-neutral-500">{r.reversal_reason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest ${STATUS[r.status] ?? ""}`}>
                      {r.status}
                    </span>
                    {ready && r.payout_ready && (
                      <button
                        onClick={() => release(r.id)}
                        disabled={busy === r.id}
                        className="rounded-lg bg-[#39FF14] px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                      >
                        {busy === r.id ? "Paying…" : "Pay now"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
