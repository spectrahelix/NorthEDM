import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { recordCommission, voidCommission, commissionTerms } from "@/utils/commissions";

// FestDash Stripe webhook. Orders are created with capture_method=manual, so a
// completed Checkout means the card is AUTHORIZED (funds held in escrow), not
// captured. On that event we promote the order out of "awaiting_payment" into
// the vendor queue ("pending") and record the PaymentIntent for later capture.
//
// Endpoint to register in Stripe: /api/festdash/stripe/webhook
// Events: checkout.session.completed, payment_intent.canceled,
//         payment_intent.payment_failed
export const dynamic = "force-dynamic";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  let event: Stripe.Event;
  try {
    if (!sig || !secret) throw new Error("missing signature/secret");
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json(
      { error: `Webhook signature failed: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  const db = admin();

  if (event.type === "checkout.session.completed" && event.data.object &&
      (event.data.object as Stripe.Checkout.Session).metadata?.kind === "service_quote") {
    // ── Service quote payment → record + pay the promoter's cash commission ──
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteId = session.metadata?.quote_id;
    const portion = Math.round(Number(session.metadata?.portion || 0));
    if (quoteId) {
      const { data: q } = await db.from("service_quotes").select("*").eq("id", quoteId).maybeSingle();
      const seen: string[] = (q?.paid_sessions ?? []) as string[];
      if (q && !seen.includes(session.id)) {
        const newPaid = (q.amount_paid_cents || 0) + portion;
        // What the customer actually owes after any promoter discount.
        const effectiveTotal = Math.max(0, (q.total_cents || 0) - (q.discount_cents || 0));
        const status = newPaid >= effectiveTotal ? "paid" : "deposit_paid";
        await db.from("service_quotes").update({
          amount_paid_cents: newPaid,
          status,
          stripe_payment_intent: (session.payment_intent as string) ?? q.stripe_payment_intent,
          paid_sessions: [...seen, session.id],
          updated_at: new Date().toISOString(),
        }).eq("id", q.id);

        // Commission is RECORDED, not paid. It becomes payable only after the
        // refund-protection window closes (see utils/commissions.ts) — during the
        // window nothing has moved, so a refund is a void rather than a clawback.
        if (status === "paid" && q.promoter_user_id) {
          const { holdDays } = await commissionTerms(db, "service_quote");
          await recordCommission(db, {
            promoterUserId: q.promoter_user_id,
            source: "service_quote",
            sourceId: q.id,
            baseCents: q.total_cents,            // % of LIST, not the discounted price
            rateBps: q.commission_bps || 0,
            holdDays,
          });
        }
      }
    }
  } else if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.festdash_order_id || session.client_reference_id;
    if (orderId) {
      const { data: order } = await db
        .from("festdash_orders")
        .select("id, status, payment_status")
        .eq("id", orderId)
        .maybeSingle();
      // Only promote an order that's still waiting — never clobber a later state.
      if (order && order.status === "awaiting_payment") {
        await db
          .from("festdash_orders")
          .update({
            status: "pending",
            paid: true,
            payment_status: "authorized",
            stripe_payment_intent: (session.payment_intent as string) ?? null,
          })
          .eq("id", orderId);
      }
    }
  } else if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
    // ── Sale undone → void the promoter's commission ──────────────────────────
    // Almost always this lands while the commission is still held, so nothing has
    // moved and the void is pure bookkeeping. voidCommission() falls back to a
    // transfer reversal only for the rare already-released case.
    const charge = event.data.object as Stripe.Charge | Stripe.Dispute;
    const paymentIntent =
      typeof (charge as Stripe.Charge).payment_intent === "string"
        ? ((charge as Stripe.Charge).payment_intent as string)
        : typeof (charge as Stripe.Dispute).payment_intent === "string"
          ? ((charge as Stripe.Dispute).payment_intent as string)
          : null;
    const reason = event.type === "charge.refunded" ? "refunded" : "disputed";

    if (paymentIntent) {
      // Map the payment back to whatever it paid for.
      const { data: quote } = await db
        .from("service_quotes").select("id").eq("stripe_payment_intent", paymentIntent).maybeSingle();
      if (quote) await voidCommission(db, "service_quote", quote.id, reason);

      const { data: order } = await db
        .from("shop_orders").select("id").eq("stripe_payment_intent", paymentIntent).maybeSingle();
      if (order) await voidCommission(db, "shop_order", String(order.id), reason);
    }
  } else if (
    event.type === "payment_intent.canceled" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.festdash_order_id;
    if (orderId) {
      const status = event.type === "payment_intent.canceled" ? "canceled" : "failed";
      await db
        .from("festdash_orders")
        .update({ payment_status: status, paid: false })
        .eq("id", orderId)
        .eq("stripe_payment_intent", pi.id);
    }
  }

  return NextResponse.json({ received: true });
}
