"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/utils/money";
import { STORE_SLOT_PLANS, type StoreSlots, type StoreUpgradeQuote } from "@/utils/storePlans";

type UpgradeResponse = {
  quote?: StoreUpgradeQuote;
  slots?: StoreSlots;
  pending?: boolean;
  payment_url?: string;
  can_cancel?: boolean;
  error?: string;
};

function applyStatus(result: UpgradeResponse, currentSlots: StoreSlots, setStatus: (result: UpgradeResponse) => void) {
  if (result.slots && result.slots > currentSlots) window.location.reload();
  else setStatus(result);
}

export function StorePlanUpgrade({ slug, currentSlots }: { slug: string; currentSlots: StoreSlots }) {
  const options = STORE_SLOT_PLANS.filter(plan => plan.slots > currentSlots);
  const [selection, setSelection] = useState<StoreSlots>();
  const [status, setStatus] = useState<UpgradeResponse>();
  const [quote, setQuote] = useState<StoreUpgradeQuote>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const target = selection ?? options[0]?.slots;
  const statusUrl = "/api/billing/upgrade?" + new URLSearchParams({ storeSlug: slug });

  useEffect(() => {
    const controller = new AbortController();
    fetch(statusUrl, { signal: controller.signal }).then(async response => {
      const result: UpgradeResponse = await response.json();
      if (controller.signal.aborted) return;
      if (response.ok) applyStatus(result, currentSlots, setStatus);
      else setError(result.error || "Couldn't check for a pending upgrade.");
    }).catch(() => {
      if (!controller.signal.aborted) setError("Couldn't check for a pending upgrade.");
    });
    return () => controller.abort();
  }, [statusUrl, currentSlots]);

  async function run(action: "preview" | "confirm" | "cancel" | "status") {
    setBusy(true);
    setError("");
    try {
      const response = action === "status" ? await fetch(statusUrl) : await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, storeSlug: slug, slots: target, consent: action === "confirm" ? quote : undefined }),
      });
      const result: UpgradeResponse = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't update your store plan.");
      setQuote(result.quote);
      if (!result.quote) applyStatus(result, currentSlots, setStatus);
    } catch (e) {
      setError((e as Error).message);
      setQuote(undefined);
    } finally {
      setBusy(false);
    }
  }

  const periodEnd = quote ? new Date(quote.period_end * 1000).toLocaleDateString() : "";
  const adjustment = quote ? formatMoney(Math.max(0, quote.adjustment_cents), "USD") : "";
  return (
    <section className="mt-4 space-y-3 border-t border-white/10 pt-4">
      <h3 className="text-sm font-semibold text-white">Upgrade listing limit</h3>
      {status?.pending ? (
        <div className="space-y-2 text-sm text-neutral-300">
          <p role="status">Your upgrade is pending. The higher limit starts when Stripe confirms payment.</p>
          <div className="flex flex-wrap items-center gap-3">
            {status.payment_url && <a href={status.payment_url} className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white">Complete payment in Stripe</a>}
            <button onClick={() => run("status")} disabled={busy} className="underline disabled:opacity-50">Check payment status</button>
            {status.can_cancel && <button onClick={() => run("cancel")} disabled={busy} className="underline disabled:opacity-50">Cancel upgrade</button>}
          </div>
        </div>
      ) : status ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-neutral-300">New listing limit
              <select value={target} disabled={busy} onChange={event => {
                setSelection(Number(event.target.value) as StoreSlots);
                setQuote(undefined);
              }} className="ml-2 rounded-lg border border-white/15 bg-neutral-900 px-2 py-1.5 text-white">
                {options.map(plan => <option key={plan.slots} value={plan.slots}>{plan.slots} slots · {formatMoney(plan.cents, "USD")}/mo</option>)}
              </select>
            </label>
            <button onClick={() => run("preview")} disabled={busy} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white disabled:opacity-50">Review upgrade</button>
          </div>
          {quote && (
            <div className="space-y-2 rounded-xl bg-black/25 p-3 text-sm text-neutral-200">
              <p><strong>{adjustment} upgrade adjustment</strong> through {periodEnd}. Stripe applies any available credit before charging your card.</p>
              <p>{quote.recurring_cents === null ? `Your plan ends on ${periodEnd}.` : `Renews at ${formatMoney(quote.recurring_cents, "USD")}/month starting ${periodEnd} until canceled.`}</p>
              <p className="text-xs text-neutral-400">Confirm to authorize the adjustment on your saved payment method and accept the new plan rate. <Link href="/terms#subscriptions" className="text-orange-300 underline">Subscription terms</Link></p>
              <button onClick={() => run("confirm")} disabled={busy} className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Checking Stripe…" : `Confirm upgrade to ${quote.slots} slots`}</button>
            </div>
          )}
        </div>
      ) : <button onClick={() => run("status")} disabled={busy} className="text-sm text-neutral-300 underline disabled:opacity-50">Check upgrade availability</button>}
      {error && <p role="alert" className="text-sm text-[#FF5C3A]">{error}</p>}
    </section>
  );
}
