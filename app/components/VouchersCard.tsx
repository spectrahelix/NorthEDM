"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type V = { id: string; code: string; percent_off: number | null; amount_off_cents: number | null; expires_at: string | null };

/** A member's unused vouchers — shown on their own profile; gone once used. */
export function VouchersCard() {
  const [v, setV] = useState<V[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { fetch("/api/vouchers/mine").then((r) => (r.ok ? r.json() : null)).then((j) => setV(j?.vouchers ?? [])).catch(() => setV([])); }, []);
  if (!v || v.length === 0) return null;
  const off = (x: V) => x.percent_off != null ? `${x.percent_off}% off` : `$${((x.amount_off_cents ?? 0) / 100).toFixed(2)} off`;
  return (
    <div className="mb-6 rounded-2xl border border-[#E8FF47]/30 bg-[#E8FF47]/[0.05] p-5">
      <p className="font-dm-mono text-xs uppercase tracking-widest text-[#E8FF47]">Your vouchers</p>
      <p className="mt-1 text-sm text-neutral-400">One-time codes for your first month of any plan: FestDash listing, your own online store, or both together. Enter the code when you subscribe.</p>
      <div className="mt-3 space-y-1.5">
        {v.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2">
            <span className="font-dm-mono text-sm text-white">{x.code} <span className="text-neutral-400">· {off(x)} your first month</span>{x.expires_at ? <span className="text-neutral-500"> · until {new Date(x.expires_at).toLocaleDateString()}</span> : null}</span>
            <button onClick={() => { navigator.clipboard.writeText(x.code); setCopied(x.id); setTimeout(() => setCopied(null), 1500); }} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-neutral-200 hover:bg-white/5">{copied === x.id ? "Copied ✓" : "Copy"}</button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">Use it from your <Link href="/festdash/vendor-dashboard" className="text-[#3AFFD4] underline">FestDash dashboard</Link> or your store&apos;s manage page.</p>
    </div>
  );
}
