"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/utils/money";
import type { PassOption } from "@/utils/festdashPass";
import { IntlPaymentNote } from "@/app/components/IntlPaymentNote";

// FestDash pass (2026-11-04): pay once, no service fee on FestDash orders for
// the pass's length. The runner fee is the runner's and is never waived.
type Info = {
  passes: PassOption[];
  service_fee_bps: number;
  service_fee_min_cents: number;
  active: { pass_key: string; ends_at: string } | null;
  signedIn: boolean;
};

export default function FestDashPassPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [bought, setBought] = useState(false);

  useEffect(() => {
    fetch("/api/festdash/pass").then((r) => r.json()).then((j: Info) => { setInfo(j); setBought(new URLSearchParams(window.location.search).has("bought")); }).catch(() => setError("Couldn't load the passes. Refresh to try again."));
  }, []);

  async function buy(key: string) {
    setBusy(key); setError("");
    try {
      const r = await fetch("/api/festdash/pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || "Couldn't start the payment.");
      window.location.assign(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the payment.");
      setBusy(null);
    }
  }

  const pct = info ? info.service_fee_bps / 100 : 5;
  const min = info?.service_fee_min_cents ?? 100;
  const ends = info?.active ? new Date(info.active.ends_at) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-neutral-200">
      <Link href="/festdash" className="text-sm text-neutral-500 hover:text-neutral-300">← FestDash</Link>
      <h1 className="mt-3 font-bold text-3xl text-white">FestDash pass</h1>
      <p className="mt-2 text-neutral-400">
        Every FestDash order has a {pct}% service fee ({formatMoney(min, "USD")} minimum on US orders). With a pass you pay no service fee on any order until it runs out, so it pays for itself after a few orders.
        The runner fee isn&apos;t affected: that always goes in full to the person who brings your order.
      </p>

      {bought && !ends && (
        <p className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">Payment received. Your pass switches on in a moment; refresh this page to see it.</p>
      )}
      {ends && (
        <p className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          Your pass is on: no service fee until {ends.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Buying another adds its days after this one ends.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(info?.passes ?? []).map((p) => (
          <div key={p.key} className="flex flex-col rounded-2xl border border-white/10 bg-white/3 p-5">
            <p className="font-semibold text-white">{p.label}</p>
            <p className="mt-1 text-2xl font-bold text-orange-400">{formatMoney(p.price_cents, "USD")}</p>
            <p className="mt-1 text-sm text-neutral-500">No service fee for {p.days} days</p>
            {info?.signedIn ? (
              <button type="button" disabled={!!busy} onClick={() => buy(p.key)}
                className="mt-4 rounded-xl bg-orange-500 px-4 py-2 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-50">
                {busy === p.key ? "Opening checkout…" : "Buy"}
              </button>
            ) : (
              <Link href="/login?next=%2Ffestdash%2Fpass" className="mt-4 rounded-xl border border-orange-500/50 px-4 py-2 text-center font-semibold text-orange-300 hover:bg-orange-500/10">Sign in to buy</Link>
            )}
          </div>
        ))}
      </div>
      {!info && !error && <p className="mt-6 text-sm text-neutral-500">Loading…</p>}
      {error && <p className="mt-4 text-sm text-[#FF5C3A]">{error}</p>}
      <IntlPaymentNote className="mt-6" />
      <p className="mt-3 text-xs text-neutral-600">Charged once by card, in US dollars. A pass doesn&apos;t renew by itself and isn&apos;t refundable once it starts.</p>
    </main>
  );
}
