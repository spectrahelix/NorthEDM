"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/utils/money";

/**
 * "Set up payouts" for any vendor (marketplace inventory page, store manage
 * page). Same Connect onboarding FestDash vendors use; the account lives on
 * vendors.stripe_account_id, so one setup covers FestDash and store sales.
 */
export function PayoutsCard({ returnTo }: { returnTo: string }) {
  const [s, setS] = useState<{ connected: boolean; onboarded: boolean } | null>(null);
  const [owed, setOwed] = useState<{ owed_cents: number; paid_cents: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/festdash/stripe/status").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setS({ connected: !!j.connected, onboarded: !!j.onboarded }); }).catch(() => {});
    fetch("/api/vendor/payouts").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setOwed(j); }).catch(() => {});
  }, []);
  async function connect() {
    setBusy(true);
    const res = await fetch("/api/festdash/stripe/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnTo }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) { window.location.href = j.url; return; }
    alert(j.error ?? "Couldn't start payout setup.");
    setBusy(false);
  }
  if (!s) return null;
  if (s.onboarded) {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5 text-sm">
        <p className="font-semibold text-green-300">✅ Payouts connected</p>
        <p className="mt-1 text-neutral-400">Your share of each sale goes to your Stripe account automatically.{owed && owed.paid_cents > 0 ? ` Paid so far: ${formatMoney(owed.paid_cents, "USD")}.` : ""}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5 text-sm">
      <p className="font-semibold text-orange-300">💳 Set up payouts</p>
      <p className="mt-1 text-neutral-400">
        Connect a bank account through Stripe so your share of every sale reaches you automatically.
        {owed && owed.owed_cents > 0 ? <> <span className="text-white">{formatMoney(owed.owed_cents, "USD")} is waiting for you</span> from sales already made.</> : null}
      </p>
      <button onClick={connect} disabled={busy} className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
        {busy ? "Opening Stripe…" : s.connected ? "Finish payout setup" : "Set up payouts"}
      </button>
    </div>
  );
}
