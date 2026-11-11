"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/utils/money";
import { BUNDLE_STORE_SLOTS, STORE_PLAN_TERMS_VERSION, STORE_SLOT_PLANS, type StoreSlots } from "@/utils/storePlans";
import { StorePlanUpgrade } from "@/app/components/StorePlanUpgrade";

type Status = {
  not_applicable?: boolean; active?: boolean; status?: string | null; current_period_end?: string | null; active_kind?: string | null;
  amount_cents?: number; recurring_cents?: number; list_cents?: number; discounted?: boolean; discount_label?: string | null; invalid_code?: boolean; has_customer?: boolean;
  bundle_available?: boolean; bundle_cents?: number; single_cents?: number; wallet_rail?: boolean; coordinator_paid_through?: string | null;
  bundle_quote?: { amount_cents: number; recurring_cents: number } | null;
  slot_limit?: StoreSlots | null; selected_slots?: number; quoted_slots?: StoreSlots | null;
  manually_active?: boolean; can_subscribe?: boolean; pending_checkout?: boolean;
  can_upgrade?: boolean;
};

async function getBillingStatus(kind: "festdash" | "store", slug: string | undefined, slots: StoreSlots, code: string): Promise<Status | null> {
  const params = new URLSearchParams({ kind });
  if (slug) params.set("storeSlug", slug);
  if (kind === "store") params.set("slots", String(slots));
  if (code) params.set("code", code);
  return fetch("/api/billing/status?" + params).then(r => r.ok ? r.json() : null).catch(() => null);
}

/**
 * The monthly subscription card on the vendor dashboard (FestDash listing) and
 * the store manage page (store subscription). Subscribe opens Stripe Checkout;
 * Manage opens the Stripe Billing Portal. Offers the FestDash + Store bundle
 * (buy one, get one half off) and takes a referral or discount code that
 * adjusts the total before checkout. Hidden for wallet-rail shops.
 */
export function BillingCard({ kind, storeSlug, what, returnPath, catalogRevision }: { kind: "festdash" | "store"; storeSlug?: string; what: string; returnPath?: string; catalogRevision?: number }) {
  const [s, setS] = useState<Status | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [slots, setSlots] = useState<StoreSlots>(5);
  const [acceptedQuote, setAcceptedQuote] = useState("");
  const [mine, setMine] = useState<{ code: string; percent_off: number | null; amount_off_cents: number | null }[]>([]);
  async function load(c: string) {
    const j = await getBillingStatus(kind, storeSlug, slots, c);
    if (j) setS(j);
    return j;
  }
  useEffect(() => {
    let current = true;
    getBillingStatus(kind, storeSlug, slots, applied).then(j => { if (current && j) setS(j); });
    return () => { current = false; };
  }, [kind, storeSlug, slots, catalogRevision, applied]);
  useEffect(() => { fetch("/api/vouchers/mine").then((r) => (r.ok ? r.json() : null)).then((j) => setMine(j?.vouchers ?? [])).catch(() => {}); }, []);
  if (!s || s.not_applicable) return null;
  // A wallet-rail shop whose coordinator has logged its fee is paid up; the card is an alternative, not a nag.
  const paidByCoordinator = !s.active && !!s.coordinator_paid_through && new Date(s.coordinator_paid_through) >= new Date(new Date().toDateString());
  const active = s.active || s.manually_active;
  const quoteReady = kind !== "store" || s.quoted_slots === slots;
  const fitsPlan = (s.selected_slots ?? 0) <= slots;
  const quoteKey = JSON.stringify([slots, applied, s.amount_cents, s.recurring_cents, s.bundle_quote]);
  const agreed = acceptedQuote === quoteKey;

  async function apply() {
    setErr("");
    const j = await load(code.trim());
    if (!j) { setErr("Couldn't check that code. Try again."); return; }
    if (j?.invalid_code) { setErr("That code isn't valid or has already been used."); setApplied(""); return; }
    setApplied(code.trim().toUpperCase());
  }
  async function go(path: "/api/billing/checkout" | "/api/billing/portal", k: "festdash" | "store" | "bundle" = kind) {
    setBusy(k); setErr("");
    const price = k === "bundle" ? s?.bundle_quote : s;
    const consent = agreed && k !== "festdash" && price ? {
      version: STORE_PLAN_TERMS_VERSION, slots: k === "bundle" ? BUNDLE_STORE_SLOTS : slots,
      first_cents: price.amount_cents, recurring_cents: price.recurring_cents,
    } : undefined;
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: k, storeSlug, code: applied || undefined, returnPath, slots, consent }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) { window.location.href = j.url; return; }
      throw new Error(j.error || "Couldn't open Stripe.");
    } catch (e) { setBusy(null); setErr((e as Error).message); }
  }
  async function cancelPending() {
    setBusy("cancel"); setErr("");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel_pending", storeSlug }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setAcceptedQuote("");
      await load(applied);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }
  const price = formatMoney(s.amount_cents ?? 0, "USD");
  const through = s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const viaBundle = s.active && s.active_kind === "bundle";
  const bundlePrice = formatMoney(s.bundle_quote?.recurring_cents ?? s.bundle_cents ?? 0, "USD");

  return (
    <div className={`mb-4 rounded-2xl border px-5 py-4 ${active || paidByCoordinator ? "border-green-500/30 bg-green-950/20" : "border-orange-500/30 bg-orange-950/20"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`font-semibold ${active || paidByCoordinator ? "text-green-300" : "text-orange-300"}`}>
            {active ? `✓ ${viaBundle ? "FestDash + Store bundle" : what} active` : paidByCoordinator ? `✓ ${what} paid through your coordinator` : kind === "store" ? "Choose a monthly store plan" : `${what} — ${price}/month`}
          </p>
          {s.wallet_rail && !s.active && (
            <p className="text-sm text-neutral-400">{paidByCoordinator ? `Paid up to ${new Date(s.coordinator_paid_through!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. ` : ""}Pay by card here, or pay your coordinator in dalasi — either works.</p>
          )}
          <p className="text-sm text-neutral-400">
            {s.manually_active ? "Your store has active access under its existing arrangement." : s.active
              ? `Paid through ${through ?? "the current period"}. Manage renewal and payment details in Stripe.`
              : `${what === "FestDash listing" ? "Your shop is hidden from FestDash until the listing is active." : "Your store can't take orders until the subscription is active."} ${s.discount_label ? `${s.discount_label}: ${price} instead of ${formatMoney(s.list_cents ?? 0, "USD")}${s.recurring_cents != null && s.recurring_cents !== s.amount_cents ? `, then ${formatMoney(s.recurring_cents, "USD")}/month` : ""}.` : ""}`}
          </p>
          {kind === "store" && s.slot_limit && <p className="text-sm text-neutral-300">{s.selected_slots ?? 0} of {s.slot_limit} storefront slots selected.</p>}
          {kind === "store" && s.active && <p className="mt-1 text-xs text-neutral-400">To move to a smaller plan, cancel renewal in Manage billing and select the smaller plan after the paid period ends.</p>}
          {err && <p className="mt-1 text-xs text-[#FF5C3A]">{err}</p>}
        </div>
        {s.active || s.has_customer ? (
          <button onClick={() => go("/api/billing/portal")} disabled={!!busy} className="shrink-0 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50">{busy ? "Opening…" : "Manage billing"}</button>
        ) : null}
      </div>

      {s.can_upgrade && storeSlug && s.slot_limit && <StorePlanUpgrade slug={storeSlug} currentSlots={s.slot_limit} />}
      {!active && (s.can_subscribe ?? !s.has_customer) && (
        <div className="mt-4 space-y-3">
          {kind === "store" && <fieldset>
            <legend className="mb-2 text-sm text-neutral-300">Product slots</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STORE_SLOT_PLANS.map(plan => <label key={plan.slots} className={`cursor-pointer rounded-xl border p-3 text-sm ${slots === plan.slots ? "border-orange-400 bg-orange-500/10" : "border-white/10"}`}>
                <input className="mr-2" type="radio" name={`slots-${storeSlug}`} checked={slots === plan.slots} onChange={() => { setSlots(plan.slots); setAcceptedQuote(""); setErr(""); }} />
                {plan.slots} slots
                <span className="mt-1 block text-neutral-300">{formatMoney(plan.cents, "USD")}/mo</span>
              </label>)}
            </div>
            <p className="mt-2 text-xs text-neutral-400">Save your storefront selection below. Sizes of the same product share one slot.</p>
            {!fitsPlan && <p className="mt-1 text-xs text-orange-300">Save at most {slots} listings before selecting this plan.</p>}
          </fieldset>}
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
          {(kind === "store" || s.bundle_available) && <label className="flex items-start gap-2 text-xs text-neutral-300">
            <input type="checkbox" checked={agreed} onChange={e => setAcceptedQuote(e.target.checked ? quoteKey : "")} />
            <span>I authorize monthly renewal at the recurring price shown for the plan I choose.</span>
          </label>}
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => go("/api/billing/checkout")} disabled={!!busy || (kind === "store" && (!agreed || !fitsPlan || !quoteReady))} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
              {busy === kind ? "Opening Stripe…" : `${kind === "store" ? `${slots} slots` : what} · ${formatMoney(s.recurring_cents ?? s.amount_cents ?? 0, "USD")}/mo`}
            </button>
            {s.bundle_available && (
              <button onClick={() => go("/api/billing/checkout", "bundle")} disabled={!!busy || !agreed || !s.bundle_quote} className="rounded-xl border border-[#E8FF47]/40 bg-[#E8FF47]/10 px-4 py-2.5 text-left text-sm text-[#E8FF47] hover:bg-[#E8FF47]/20 disabled:opacity-50">
                <span className="block font-semibold">{busy === "bundle" ? "Opening Stripe…" : `FestDash + 30-slot store · ${bundlePrice}/mo`}</span>
                {s.bundle_quote && s.bundle_quote.amount_cents !== s.bundle_quote.recurring_cents && <span className="block text-xs">{formatMoney(s.bundle_quote.amount_cents, "USD")} for the first month.</span>}
              </button>
            )}
          </div>
          {s.pending_checkout && <button onClick={cancelPending} disabled={!!busy} className="text-sm text-neutral-300 underline disabled:opacity-50">Cancel unfinished checkout</button>}
        </div>
      )}
    </div>
  );
}
