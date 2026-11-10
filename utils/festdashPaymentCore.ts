import type Stripe from "stripe";

export type FestdashPaymentResult = { status: string; paid: boolean; refundId?: string };

/** Provider operation only. The caller must first verify the two-party handoff
 * or a terminal failed order. Stable keys make retries safe after timeouts. */
export async function settleFestdashCard(
  stripe: Stripe,
  order: { id: string; intent: string | null; checkout: string | null; completed: boolean; bothConfirmed: boolean; totalCents: number; currency: string; refundId?: string | null }
): Promise<FestdashPaymentResult> {
  if (order.completed && !order.bothConfirmed) throw new Error("Both parties must confirm before payment capture.");
  if (!Number.isSafeInteger(order.totalCents) || order.totalCents < 0) throw new Error("Invalid order amount.");
  if (order.totalCents === 0) return { status: order.completed ? "released" : "canceled", paid: order.completed };
  let intentId = order.intent;
  if (!intentId && order.checkout) {
    const session = await stripe.checkout.sessions.retrieve(order.checkout);
    if (!order.completed && session.status === "open") {
      await stripe.checkout.sessions.expire(session.id, {}, { idempotencyKey: `fd_expire_${order.id}` });
      return { status: "canceled", paid: false };
    }
    intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  }
  if (!intentId) {
    if (order.completed) throw new Error("No authorized card payment is attached to this order.");
    return { status: "canceled", paid: false };
  }
  const pi = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
  if (pi.amount !== order.totalCents || pi.currency !== order.currency.toLowerCase()) throw new Error("Provider payment amount or currency does not match the order.");
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  if (order.completed) {
    if (charge?.refunded || charge?.disputed || Number(charge?.amount_refunded ?? 0) > 0) throw new Error("This payment was refunded or disputed. Do not pay out.");
    if (pi.status === "requires_capture") {
      if (pi.amount_capturable < order.totalCents) throw new Error("The full order amount is not available for capture.");
      const captured = await stripe.paymentIntents.capture(pi.id, {}, { idempotencyKey: `fd_capture_${order.id}` });
      if (captured.status !== "succeeded" || captured.amount_received !== order.totalCents) throw new Error("The full order payment has not been confirmed by the provider.");
      return { status: "released", paid: true };
    }
    if (pi.status === "succeeded" && pi.amount_received === order.totalCents) return { status: "released", paid: true };
    throw new Error(pi.status === "canceled" ? "The card hold expired or was canceled. Payment needs review; do not pay out." : "Card funds are not available for capture.");
  }
  if (pi.status === "canceled") return { status: "canceled", paid: false };
  if (pi.status === "succeeded") {
    if (charge?.refunded) return { status: "refunded", paid: false };
    const destination = !!pi.transfer_data?.destination;
    const refund = order.refundId ? await stripe.refunds.retrieve(order.refundId) : await stripe.refunds.create({
      payment_intent: pi.id,
      ...(destination ? { reverse_transfer: true, refund_application_fee: true } : {}),
      metadata: { festdash_order_id: order.id, reason: "failed_order" },
    }, { idempotencyKey: `fd_failed_refund_${order.id}` });
    if (refund.status === "succeeded") return { status: "refunded", paid: false, refundId: refund.id };
    if (refund.status === "failed" || refund.status === "canceled") throw new Error("The payment provider could not complete the refund. Retry or review is required.");
    return { status: "refund_pending", paid: false, refundId: refund.id };
  }
  await stripe.paymentIntents.cancel(pi.id, {}, { idempotencyKey: `fd_cancel_${order.id}` });
  return { status: "canceled", paid: false };
}
