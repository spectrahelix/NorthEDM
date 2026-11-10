import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";
import { settleFestdashCard } from "@/utils/festdashPaymentCore";
import { checkWrite } from "@/utils/dbWrite";
import { loadSplitSettings, recordSaleSplit } from "@/utils/coordinator";
import { isLocalRail } from "@/utils/gambiaPay";
import { commissionTerms, recordCommission } from "@/utils/commissions";
import { payRunnerFee } from "@/utils/runnerPay";
import { notifyFeedback } from "@/utils/alerts";
import { ensureFestdashHandoff } from "@/utils/festdashHandoff";

const ORDER_COLUMNS = "id, vendor_id, customer_id, driver_id, status, payment_status, payment_method, stripe_payment_intent, stripe_checkout_session, total_cents, runner_fee_cents, service_fee_cents, remit_fee_cents, currency, fulfillment, updated_at";

/** Fulfillment and provider settlement are separate. A completed handoff is
 * durable even if Stripe times out; retries retrieve Stripe's actual state. */
export async function settleFestdashOrder(admin: SupabaseClient, orderId: string) {
  const [{ data: o, error: orderError }, { data: handoff, error: handoffError }] = await Promise.all([
    admin.from("festdash_orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle(),
    admin.from("festdash_handoffs").select("customer_confirmed_at, fulfiller_confirmed_at, problem_reported_at, settled_at, last_error, stripe_refund_id").eq("order_id", orderId).maybeSingle(),
  ]);
  if (orderError || handoffError) throw new Error("Payment records are unavailable. No settlement attempted.");
  if (!o || !["delivered", "declined"].includes(o.status)) throw new Error("Order is not ready for settlement.");
  const completed = o.status === "delivered";
  const bothConfirmed = !!handoff?.customer_confirmed_at && !!handoff?.fulfiller_confirmed_at && !handoff.problem_reported_at;
  if (completed && !bothConfirmed) throw new Error("Both parties must confirm before payment capture.");
  if (handoff?.settled_at) return { status: o.payment_status, pending: false };
  if (["capturing", "canceling"].includes(o.payment_status) && Date.now() - Date.parse(o.updated_at) < 120_000) {
    return { status: o.payment_status, pending: true };
  }
  const { data: claim, error: claimError } = await admin.from("festdash_orders")
    .update({ payment_status: completed ? "capturing" : "canceling", updated_at: new Date().toISOString() })
    .eq("id", orderId).eq("status", o.status).eq("payment_status", o.payment_status).eq("updated_at", o.updated_at)
    .select("id").maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claim) return { status: o.payment_status, pending: true };

  try {
    if (o.payment_method !== "card") throw new Error("This legacy payment needs manual settlement or refund through its original provider. No automatic payout was made.");
    const result = await settleFestdashCard(getStripe(), {
      id: orderId, intent: o.stripe_payment_intent, checkout: o.stripe_checkout_session, completed, bothConfirmed,
      totalCents: Number(o.total_cents), currency: o.currency, refundId: handoff?.stripe_refund_id,
    });
    const written = await checkWrite(`FestDash ${orderId} payment -> ${result.status}`, await admin.from("festdash_orders")
      .update({ payment_status: result.status, paid: result.paid, ...(result.status === "released" ? { escrow_released_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() })
      .eq("id", orderId).eq("status", o.status), { critical: true });
    if (!written) throw new Error("Provider settlement succeeded but the order record needs reconciliation.");

    if (result.status === "released") {
      const { data: vendor, error } = await admin.from("vendors").select("coordinator_user_id, user_id, currency").eq("id", o.vendor_id).maybeSingle();
      if (error || !vendor) throw new Error("Paid order's vendor could not be loaded for settlement.");
      if (isLocalRail(vendor)) {
        const row = await recordSaleSplit(admin, {
          id: orderId, vendor_id: Number(o.vendor_id), total_cents: Number(o.total_cents), runner_fee_cents: Number(o.runner_fee_cents ?? 0),
          service_fee_cents: Number(o.service_fee_cents ?? 0), remit_fee_cents: Number(o.remit_fee_cents ?? 0),
          currency: o.currency, payment_method: "card", payment_ref: o.stripe_payment_intent, collected_by: "owner", delivery: o.fulfillment !== "pickup",
        }, vendor.coordinator_user_id, await loadSplitSettings(admin), null);
        if (!row) throw new Error("Payment captured; regional payout ledger still needs reconciliation.");
      } else {
        await payRunnerFee(admin, orderId); // No account yet stays owed for the existing payout sweep.
        if (vendor.coordinator_user_id) {
          const splits = await loadSplitSettings(admin);
          const { holdDays } = await commissionTerms(admin, "festdash_order");
          const commission = await recordCommission(admin, {
            promoterUserId: vendor.coordinator_user_id, referredUserId: vendor.user_id,
            source: "festdash_order", sourceId: orderId,
            baseCents: Number(o.total_cents) - Number(o.runner_fee_cents ?? 0) - Number(o.service_fee_cents ?? 0) - Number(o.remit_fee_cents ?? 0),
            rateBps: splits.sale_coordinator_bps, holdDays,
          });
          if (!commission.ok && commission.reason !== "zero amount") throw new Error("Payment captured; commission record still needs reconciliation.");
        }
      }
    }
    const final = ["released", "canceled", "refunded"].includes(result.status);
    const saved = await admin.from("festdash_handoffs").update({ last_error: null, ...(result.refundId ? { stripe_refund_id: result.refundId } : {}), settled_at: final ? new Date().toISOString() : null }).eq("order_id", orderId);
    if (saved.error) throw new Error("Settlement marker could not be saved; reconciliation will retry.");
    await admin.from("festdash_customer_live").delete().eq("order_id", orderId);
    return { status: result.status, pending: !final };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider settlement failed.";
    console.error(`FestDash settlement needs review (${orderId}):`, message);
    await checkWrite(`FestDash ${orderId} settlement retry state`, await admin.from("festdash_orders")
      .update({ payment_status: completed ? "capture_failed" : "refund_failed", updated_at: new Date().toISOString() }).eq("id", orderId), { critical: true });
    await admin.from("festdash_handoffs").update({ last_error: message.slice(0, 500), settled_at: null }).eq("order_id", orderId);
    if (handoff?.last_error !== message.slice(0, 500)) await notifyFeedback({ category: "festdash-payment", message: `FestDash order ${orderId} needs payment reconciliation. ${message}` }).catch(() => {});
    return { status: completed ? "capture_failed" : "refund_failed", pending: true, error: "Payment settlement needs retry or support review. No completion or refund guarantee is shown until the provider confirms it." };
  }
}

/** Shared by the signed webhook and the customer's authenticated fallback.
 * A late checkout must never resurrect a canceled order or escape its refund. */
export async function recordFestdashAuthorization(admin: SupabaseClient, orderId: string, intentId: string) {
  const pi = await getStripe().paymentIntents.retrieve(intentId);
  if (pi.metadata.festdash_order_id !== orderId) throw new Error("Payment does not belong to this FestDash order.");
  const { data: original, error } = await admin.from("festdash_orders").select("status, payment_status").eq("id", orderId).maybeSingle();
  if (error || !original) throw new Error("Order could not be loaded for authorization.");
  if (original.status === "awaiting_payment" && pi.status === "requires_capture") {
    const result = await admin.from("festdash_orders").update({ status: "pending", paid: true, payment_status: "authorized", stripe_payment_intent: pi.id })
      .eq("id", orderId).eq("status", "awaiting_payment").select("id").maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (result.data) return { status: "pending", payment_status: "authorized" };
  }
  let { data: current } = await admin.from("festdash_orders").select("status, payment_status").eq("id", orderId).maybeSingle();
  if (!current) throw new Error("Order state is unavailable.");
  if (current.status === "awaiting_payment" && ["canceled", "succeeded"].includes(pi.status)) {
    await admin.from("festdash_orders").update({ status: "declined" }).eq("id", orderId).eq("status", "awaiting_payment");
    ({ data: current } = await admin.from("festdash_orders").select("status, payment_status").eq("id", orderId).maybeSingle());
  }
  if (current?.status === "declined") {
    await ensureFestdashHandoff(admin, orderId);
    const reset = await admin.from("festdash_handoffs").update({ settled_at: null }).eq("order_id", orderId);
    if (reset.error) throw new Error(reset.error.message);
    const saved = await admin.from("festdash_orders").update({ stripe_payment_intent: pi.id, payment_status: "authorized", updated_at: new Date().toISOString() }).eq("id", orderId).eq("status", "declined");
    if (saved.error) throw new Error(saved.error.message);
    const result = await settleFestdashOrder(admin, orderId);
    return { status: "declined", payment_status: result.status };
  }
  return current ?? original;
}

/** Retry terminal orders; never capture an active or singly-confirmed order. */
export async function reconcileFestdashPayments(admin: SupabaseClient) {
  const { data, error } = await admin.from("festdash_handoffs")
    .select("order_id, festdash_orders!inner(status)").is("settled_at", null)
    .in("festdash_orders.status", ["delivered", "declined"]).order("created_at").limit(100);
  if (error) throw new Error(error.message);
  let pending = 0;
  for (const row of data ?? []) {
    try { if ((await settleFestdashOrder(admin, row.order_id)).pending) pending++; }
    catch (error) { console.error("FestDash reconciliation failed:", row.order_id, error); pending++; }
  }
  return { checked: data?.length ?? 0, pending };
}
