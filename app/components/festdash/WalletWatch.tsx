"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/utils/money";

type Row = { kind: "festdash" | "store"; id: string; ref: string; vendor_name: string | null; coordinator: string | null; amount_cents: number; currency: string; method: string | null; customer_ref: string; paid_to: string | null; state: "unconfirmed" | "rejected" | "reported"; created_at: string; ref_at: string | null; note: string | null };
const STATE: Record<Row["state"], [string, string]> = { reported: ["Customer reported", "text-red-300 bg-red-500/15"], rejected: ["Rejected by coordinator", "text-orange-300 bg-orange-500/15"], unconfirmed: ["Unconfirmed 24h+", "text-yellow-300 bg-yellow-500/15"] };

/** Owner's Wallet watch: every wallet payment a customer gave a reference for that wasn't confirmed, was rejected, or was reported. */
export function WalletWatch() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = () => fetch("/api/festdash/admin/wallet-watch").then((r) => (r.ok ? r.json() : { rows: [] })).then((j) => setRows(j.rows ?? [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  async function resolve(r: Row) {
    if (!confirm(`Mark ${r.ref} resolved? It leaves this list.`)) return;
    await fetch("/api/festdash/admin/wallet-watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: r.kind, id: r.id }) });
    load();
  }
  if (!rows) return null;
  return (
    <section id="wallet-watch" className="rounded-2xl border border-yellow-500/20 bg-yellow-950/10 p-5">
      <p className="font-dm-mono text-xs uppercase tracking-widest text-yellow-300">Wallet watch ({rows.length})</p>
      <p className="mt-1 text-xs text-neutral-500">Wallet payments go to the coordinator&apos;s own number, so the site can&apos;t see them land. Listed here: payments the customer gave a reference for that were rejected, sat unconfirmed for 24 hours, or that the customer reported. You&apos;re alerted when each appears.</p>
      {rows.length === 0 ? <p className="mt-3 text-sm text-neutral-600">Nothing to check.</p> : (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="text-white">{r.ref} · {formatMoney(r.amount_cents, r.currency)} by {r.method} <span className={`ml-1 rounded-full px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest ${STATE[r.state][1]}`}>{STATE[r.state][0]}</span></p>
                <p className="font-dm-mono text-[11px] text-neutral-500">{r.kind === "store" ? "store" : "FestDash"} · {r.vendor_name ?? "?"} · coordinator {r.coordinator ?? "?"} · paid to {r.paid_to ?? "?"} · customer ref {r.customer_ref} · {new Date(r.created_at).toLocaleString()}</p>
                {r.note && <p className="mt-1 text-xs text-neutral-300">Customer: “{r.note}”</p>}
              </div>
              <button onClick={() => resolve(r)} className="shrink-0 rounded-lg border border-white/15 px-3 py-1 text-xs text-neutral-300 hover:bg-white/5">Resolved</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
