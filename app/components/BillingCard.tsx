"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/utils/money";

type Status = {
  not_applicable?: boolean; active?: boolean; status?: string | null; current_period_end?: string | null;
  amount_cents?: number; list_cents?: number; discounted?: boolean; has_customer?: boolean;
};

/**
 * The monthly subscription card on the vendor dashboard (FestDash listing) and
 * the store manage page (store subscription). Subscribe opens Stripe Checkout;
 * Manage opens the Stripe Billing Portal. Hidden for wallet-rail shops.
 */
export function BillingCard({ kind, storeSlug, what }: { kind: "festdash" | "store"; storeSlug?: string; what: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    const qs = "?kind=" + kind + (storeSlug ? "&storeSlug=" + encodeURIComponent(storeSlug) : "");
    fetch("/api/billing/status" + qs).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setS(j); }).catch(() => {});
  }, [kind, storeSlug]);
  if (!s || s.not_applicable) return null;

  async function go(path: "/api/billing/checkout" | "/api/billing/portal") {
    setBusy(true); setErr("");
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, storeSlug }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) { window.location.href = j.url; return; }
    setBusy(false); setErr(j.error || "Couldn't open Stripe.");
  }
  const price = formatMoney(s.amount_cents ?? 0, "USD");
  const through = s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  return (
    <div className={`mb-4 rounded-2xl border px-5 py-4 ${s.active ? "border-green-500/30 bg-green-950/20" : "border-orange-500/30 bg-orange-950/20"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`font-semibold ${s.active ? "text-green-300" : "text-orange-300"}`}>
            {s.active ? `✓ ${what} active` : `${what} — ${price}/month`}
          </p>
          <p className="text-sm text-neutral-400">
            {s.active
              ? `Paid through ${through ?? "the current period"}. Renews automatically; manage your card or cancel any time.`
              : `${what === "FestDash listing" ? "Your shop is hidden from FestDash until the listing is active." : "Your store can't take orders until the subscription is active."} ${s.discounted ? `Referral rate: ${price} instead of ${formatMoney(s.list_cents ?? 0, "USD")}.` : ""}`}
          </p>
          {err && <p className="mt-1 text-xs text-[#FF5C3A]">{err}</p>}
        </div>
        {s.active || s.has_customer ? (
          <button onClick={() => go("/api/billing/portal")} disabled={busy} className="shrink-0 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50">{busy ? "Opening…" : "Manage billing"}</button>
        ) : (
          <button onClick={() => go("/api/billing/checkout")} disabled={busy} className="shrink-0 rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white hover:bg-orange-400 disabled:opacity-50">{busy ? "Opening Stripe…" : `Subscribe — ${price}/mo`}</button>
        )}
      </div>
    </div>
  );
}
