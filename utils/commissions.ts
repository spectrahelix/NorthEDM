import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

// Promoter commission lifecycle. See docs/WALLET.md.
//
//   sale paid  → recordCommission()  → status 'held', payable_after = +hold_days
//   window ends→ releaseCommission() → Stripe transfer / PayPal payout → 'paid'
//   refunded   → voidCommission()    → 'reversed' (no money moved if still held)
//
// The protection window is the whole point: during it NOTHING has been paid, so a
// refund is a bookkeeping change rather than a clawback. Clawing back a completed
// transfer is the fragile path — it can fail if the promoter already withdrew — so
// it exists only as a backstop for the already-released case.

export type CommissionSource = "service_quote" | "shop_order" | "vendor_listing" | "foraging_tour" | "festdash_order";

export const DEFAULT_HOLD_DAYS = 30;

/** Per-action rate + hold window, falling back to sane defaults. */
export async function commissionTerms(db: SupabaseClient, source: CommissionSource) {
  const { data } = await db
    .from("commission_rates")
    .select("rate_bps, hold_days, active")
    .eq("source_type", source)
    .maybeSingle();
  return {
    rateBps: data?.active ? (data.rate_bps ?? 0) : 0,
    holdDays: data?.hold_days ?? DEFAULT_HOLD_DAYS,
  };
}

/**
 * Record a commission as an unpaid, refund-protected obligation. Never transfers.
 * Idempotent via commissions UNIQUE(source_type, source_id), so a replayed webhook
 * cannot create a second obligation.
 */
export async function recordCommission(
  db: SupabaseClient,
  opts: {
    promoterUserId: string;
    referredUserId?: string | null;
    source: CommissionSource;
    sourceId: string;
    baseCents: number;      // LIST price — the promoter earns a % of list
    rateBps: number;
    holdDays?: number;
  }
) {
  const amount = Math.floor((opts.baseCents * opts.rateBps) / 10000);
  if (amount <= 0) return { ok: false as const, reason: "zero amount" };

  const holdDays = opts.holdDays ?? DEFAULT_HOLD_DAYS;
  const payableAfter = new Date(Date.now() + holdDays * 86400000).toISOString();

  const { error } = await db.from("commissions").insert({
    promoter_user_id: opts.promoterUserId,
    referred_user_id: opts.referredUserId ?? null,
    source_type: opts.source,
    source_id: opts.sourceId,
    base_cents: opts.baseCents,
    rate_bps: opts.rateBps,
    amount_cents: amount,
    status: "held",
    hold_days: holdDays,
    payable_after: payableAfter,
  });
  // A duplicate key just means we already recorded it — that's success, not failure.
  if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
    console.error("recordCommission failed:", error.message);
    return { ok: false as const, reason: error.message };
  }
  return { ok: true as const, amount, payableAfter };
}

/**
 * Void a commission because its sale was refunded/disputed.
 * If it is still held, no money ever moved — a pure bookkeeping void (the safe,
 * normal case). If it was already released, attempt a transfer reversal as a
 * backstop and record whether that succeeded.
 */
export async function voidCommission(
  db: SupabaseClient,
  source: CommissionSource,
  sourceId: string,
  reason: string
) {
  const { data: c } = await db
    .from("commissions")
    .select("id, status, amount_cents, stripe_transfer_id")
    .eq("source_type", source).eq("source_id", sourceId)
    .maybeSingle();
  if (!c || c.status === "reversed") return { ok: true as const, moved: false };

  if (c.status === "held") {
    await db.from("commissions")
      .update({ status: "reversed", reversed_at: new Date().toISOString(), reversal_reason: reason })
      .eq("id", c.id);
    return { ok: true as const, moved: false };
  }

  // Already paid out — try to claw back. This is best-effort by nature.
  let clawedBack = false;
  if (c.stripe_transfer_id) {
    try {
      await getStripe().transfers.createReversal(
        c.stripe_transfer_id,
        { amount: c.amount_cents, metadata: { reason } },
        { idempotencyKey: `reversal_${source}_${sourceId}` }
      );
      clawedBack = true;
    } catch (e) {
      console.error(`commission reversal failed for ${source}:${sourceId} —`, e);
    }
  }
  await db.from("commissions")
    .update({
      status: clawedBack ? "reversed" : "failed",
      reversed_at: new Date().toISOString(),
      reversal_reason: clawedBack ? reason : `${reason} (clawback FAILED — recover manually)`,
    })
    .eq("id", c.id);
  return { ok: clawedBack, moved: true };
}

/**
 * Pay out one commission whose protection window has closed. Callers must only
 * pass commissions past payable_after; the DB trigger enforces it regardless.
 */
export async function releaseCommission(
  db: SupabaseClient,
  c: { id: string; promoter_user_id: string; amount_cents: number; source_type: string; source_id: string }
) {
  const { data: promoter } = await db
    .from("festdash_promoters")
    .select("stripe_account_id, payout_method, paypal_email")
    .eq("user_id", c.promoter_user_id)
    .maybeSingle();
  if (!promoter) return { ok: false as const, reason: "promoter not found" };

  const method = promoter.payout_method === "paypal" ? "paypal" : "stripe";

  if (method === "paypal") {
    const { payPalPayout } = await import("@/utils/paypal");
    const res = await payPalPayout({
      email: promoter.paypal_email ?? "",
      amountCents: c.amount_cents,
      note: `NorthEDM promoter commission (${c.source_type})`,
      idempotencyKey: `commission_${c.source_type}_${c.source_id}`,
    });
    if (!res.ok) return { ok: false as const, reason: res.reason };
    await db.from("commissions").update({
      status: "paid", released_at: new Date().toISOString(), payout_method: "paypal",
    }).eq("id", c.id);
    return { ok: true as const };
  }

  if (!promoter.stripe_account_id) return { ok: false as const, reason: "no payout account connected" };
  try {
    const transfer = await getStripe().transfers.create(
      {
        amount: c.amount_cents, currency: "usd", destination: promoter.stripe_account_id,
        metadata: { kind: "promoter_commission", source_type: c.source_type, source_id: c.source_id },
      },
      { idempotencyKey: `commission_${c.source_type}_${c.source_id}` }
    );
    await db.from("commissions").update({
      status: "paid",
      released_at: new Date().toISOString(),
      stripe_transfer_id: transfer.id,
      payout_method: "stripe",
    }).eq("id", c.id);
    return { ok: true as const };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`commission release failed for ${c.id}:`, reason);
    return { ok: false as const, reason };
  }
}
