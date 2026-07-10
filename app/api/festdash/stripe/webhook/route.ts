import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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

  if (event.type === "checkout.session.completed") {
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
