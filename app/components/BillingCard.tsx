"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/utils/money";

type Status = {
  not_applicable?: boolean; active?: boolean; status?: string | null; current_period_end?: string | null; active_kind?: string | null;
  amount_cents?: number; recurring_cents?: number; list_cents?: number; discounted?: boolean; discount_label?: string | null; invalid_code?: boolean; has_customer?: boolean;
  bundle_available?: boolean; bundle_cents?: number; single_cents?: number; wallet_rail?: boolean; coordinator_paid_through?: string | null;
};

/**
 * The monthly subscription card on the vendor dashboard (FestDash listing) and
 * the store manage page (store subscription). Subscribe opens Stripe Checkout;
 * Manage opens the Stripe Billing Portal. Offers the FestDash + Store bundle
 * (buy one, get one half off) and takes a referral or discount code that
 * adjusts the total before checkout. Hidden for wallet-rail shops.
 */
export function BillingCard({ kind, storeSlug, what, returnPath }: { kind: "festdash" | "store"; storeSlug?: string; what: string; returnPath?: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [mine, setMine] = useState<{ code: string; percent_off: number | null; amount_off_cents: number | null }[]>([]);
  async function load(c: string) {
    const qs = "?kind=" + kind + (storeSlug ? "&storeSlug=" + encodeURIComponent(storeSlug) : "") + (c ? "&code=" + encodeURIComponent(c) : "");
    const j = await fetch("/api/billing/status" + qs).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (j) setS(j);
    return j as Status | null;
  }
  useEffect(() => { load(""); fetch("/api/vouchers/mine").then((r) => (r.ok ? r.json() : null)).then((j) => setMine(j?.vouchers ?? [])).catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind, storeSlug]);
  if (!s || s.not_applicable) return null;
  // A wallet-rail shop whose coordinator has logged its fee is paid up; the card is an alternative, not a nag.
  const paidByCoordinator = !s.active && !!s.coordinator_paid_through && new Date(s.coordinator_paid_through) >= new Date(new Date().toDateString());

  async function apply() {
    setErr("");
    const j = await load(code.trim());
    if (j?.invalid_code) { setErr("That code isn't valid or has already been used."); setApplied(""); return; }
    setApplied(code.trim().toUpperCase());
  }
  async function go(path: "/api/billing/checkout" | "/api/billing/portal", k: "festdash" | "store" | "bundle" = kind) {
    setBusy(k); setErr("");
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: k, storeSlug, code: applied || undefined, returnPath }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) { window.location.href = j.url; return; }
    setBusy(null); setErr(j.error || "Couldn't open Stripe.");
  }
  const price = formatMoney(s.amount_cents ?? 0, "USD");
  const through = s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const viaBundle = s.active && s.active_kind === "bundle";
  const bundleFirst = applied && s.bundle_cents != null && s.list_cents === s.bundle_cents ? s.amount_cents : null;

  return (
    <div className={`mb-4 rounded-2xl border px-5 py-4 ${s.active || paidByCoordinator ? "border-green-500/30 bg-green-950/20" : "border-orange-500/30 bg-orange-950/20"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`font-semibold ${s.active || paidByCoordinator ? "text-green-300" : "text-orange-300"}`}>
            {s.active ? `✓ ${viaBundle ? "FestDash + Store bundle" : what} active` : paidByCoordinator ? `✓ ${what} paid through your coordinator` : `${what} — ${price}/month`}
          </p>
          {s.wallet_rail && !s.active && (
            <p className="text-sm text-neutral-400">{paidByCoordinator ? `Paid up to ${new Date(s.coordinator_paid_through!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. ` : ""}Pay by card here, or pay your coordinator in dalasi — either works.</p>
          )}
          <p className="text-sm text-neutral-400">
            {s.active
              ? `Paid through ${through ?? "the current period"}. Renews automatically; manage your card or cancel any time.`
              : `${what === "FestDash listing" ? "Your shop is hidden from FestDash until the listing is active." : "Your store can't take orders until the subscription is active."} ${s.discount_label ? `${s.discount_label}: ${price} instead of ${formatMoney(s.list_cents ?? 0, "USD")}${s.recurring_cents != null && s.recurring_cents !== s.amount_cents ? `, then ${formatMoney(s.recurring_cents, "USD")}/month` : ""}.` : ""}`}
          </p>
          {err && <p className="mt-1 text-xs text-[#FF5C3A]">{err}</p>}
        </div>
        {s.active || s.has_customer ? (
          <button onClick={() => go("/api/billing/portal")} disabled={!!busy} className="shrink-0 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50">{busy ? "Opening…" : "Manage billing"}</button>
        ) : null}
      </div>

      {!s.active && !s.has_customer && (
        <div className="mt-4 space-y-3">
          {/* The member's own vouchers, one tap to apply */}
          {mine.length > 0 && !applied && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span>Your vouchers:</span>
              {mine.map((m) => (
                <button key={m.code} onClick={async () => { setCode(m.code); const j = await load(m.code); if (!j?.invalid_code) setApplied(m.code); }} className="rounded-full border border-[#E8FF47]/40 bg-[#E8FF47]/10 px-2.5 py-1 font-dm-mono text-[#E8FF47] hover:bg-[#E8FF47]/20">
                  {m.code} · {m.percent_off != null ? `${m.percent_off}%` : `$${((m.amount_off_cents ?? 0) / 100).toFixed(0)}`} off
                </button>
              ))}
            </div>
          )}
          {/* Referral or discount code */}
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Referral or discount code" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-dm-mono text-sm uppercase text-neutral-100 placeholder:font-sans placeholder:normal-case placeholder:text-neutral-600 outline-none" />
            <button onClick={apply} disabled={!code.trim()} className="rounded-xl border border-white/15 px-3 py-2 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-40">{applied && applied === code.trim().toUpperCase() ? "Applied ✓" : "Apply"}</button>
          </div>
          <p className="text-xs leading-6 text-neutral-400">
            Card plans renew automatically each month at the recurring price shown at checkout until you cancel. Cancel future renewals through Manage billing, or email northedm1@gmail.com for help. Review the <Link href="/terms#subscriptions" className="text-orange-300 underline underline-offset-4">subscription terms</Link> before authorizing payment.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => go("/api/billing/checkout")} disabled={!!busy} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
              {busy === kind ? "Opening Stripe…" : `${what} — ${price}/mo`}
            </button>
            {s.bundle_available && (
              <button onClick={() => go("/api/billing/checkout", "bundle")} disabled={!!busy} className="rounded-xl border border-[#E8FF47]/40 bg-[#E8FF47]/10 px-4 py-2.5 text-left text-sm text-[#E8FF47] hover:bg-[#E8FF47]/20 disabled:opacity-50">
                <span className="block font-semibold">{busy === "bundle" ? "Opening Stripe…" : `FestDash + Store bundle — ${formatMoney(bundleFirst ?? s.bundle_cents ?? 0, "USD")}/mo`}</span>
                <span className="block text-xs text-[#E8FF47]/70">Both services. Buy one, get one half off ({formatMoney(s.single_cents ?? 0, "USD")} + {formatMoney((s.single_cents ?? 0) / 2, "USD")}).</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
