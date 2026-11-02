import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

/**
 * The runner's fee. The customer picks it at checkout (10% of the items
 * minimum, more if they like) and every cent of it belongs to the runner.
 *
 * Card rail: the fee is collected inside the Stripe application fee, so after
 * capture it sits on the platform balance; this moves it to the runner's
 * Connect account. A runner who hasn't set payouts up yet is paid by the daily
 * cron the day they do. Idempotent per order (Stripe idempotency key + the
 * transfer id stored on the row). Wallet rail: the coordinator pays the runner
 * from what the customer sent; the ledger's runner_cents line records it.
 */
export async function payRunnerFee(admin: SupabaseClient, orderId: string): Promise<{ ok: boolean; reason?: string }> {
  const { data: o } = await admin
    .from("festdash_orders")
    .select("id, driver_id, runner_fee_cents, runner_fee_transfer_id, payment_method, payment_status, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return { ok: false, reason: "no such order" };
  const fee = Number(o.runner_fee_cents ?? 0);
  if (fee <= 0) return { ok: false, reason: "no fee" };
  if (o.runner_fee_transfer_id) return { ok: true };
  if (o.payment_method !== "card") return { ok: false, reason: "wallet order — paid by the coordinator" };
  if (o.status !== "delivered" || o.payment_status !== "released") return { ok: false, reason: "not delivered and captured yet" };
  if (!o.driver_id) return { ok: false, reason: "no runner on the order" };

  const { data: d } = await admin.from("festdash_drivers").select("stripe_account_id").eq("user_id", o.driver_id).maybeSingle();
  if (!d?.stripe_account_id) return { ok: false, reason: "runner has no payout account yet" };

  try {
    const transfer = await getStripe().transfers.create(
      { amount: fee, currency: "usd", destination: d.stripe_account_id, metadata: { kind: "runner_fee", festdash_order_id: o.id } },
      { idempotencyKey: `runner_fee_${o.id}` }
    );
    await admin.from("festdash_orders").update({ runner_fee_transfer_id: transfer.id, runner_fee_paid_at: new Date().toISOString() }).eq("id", o.id);
    return { ok: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`runner fee transfer failed for ${o.id}:`, reason);
    return { ok: false, reason };
  }
}

/** Daily sweep: delivered card orders whose runner fee hasn't reached the runner yet. */
export async function payPendingRunnerFees(admin: SupabaseClient) {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: due } = await admin
    .from("festdash_orders")
    .select("id")
    .eq("payment_method", "card")
    .eq("status", "delivered")
    .eq("payment_status", "released")
    .gt("runner_fee_cents", 0)
    .is("runner_fee_transfer_id", null)
    .not("driver_id", "is", null)
    .gte("created_at", since)
    .limit(100);
  let paid = 0; const skipped: string[] = [];
  for (const o of due ?? []) {
    const r = await payRunnerFee(admin, o.id as string);
    if (r.ok) paid++; else skipped.push(r.reason ?? "skipped");
  }
  return { checked: due?.length ?? 0, paid, skipped: skipped.length };
}
