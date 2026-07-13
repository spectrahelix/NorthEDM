import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notifyNewOrder } from "@/utils/alerts";

// Stripe webhook: on a completed Checkout, mark the order paid, decrement stock,
// and alert the owner. Idempotent (skips if already paid). Needs raw body for
// signature verification, so we read req.text().
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
    return NextResponse.json({ error: `Webhook signature failed: ${(e as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (orderId) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: order } = await admin
        .from("shop_orders").select("*").eq("id", orderId).maybeSingle();

      if (order && order.status !== "paid") {
        const ship = session.customer_details;
        await admin.from("shop_orders").update({
          status: "paid",
          stripe_payment_intent: (session.payment_intent as string) ?? null,
          email: session.customer_details?.email ?? order.email,
          ship_name: ship?.name ?? null,
          ship_address: ship?.address ?? null,
        }).eq("id", orderId);

        // Decrement stock for each line (never below zero).
        const items = (order.items ?? []) as { product_id: string; qty: number }[];
        for (const it of items) {
          await admin.rpc("shop_decrement_stock", { p_product: it.product_id, p_qty: it.qty });
        }

        await notifyNewOrder({
          total_cents: order.total_cents,
          email: session.customer_details?.email ?? order.email,
          itemCount: items.reduce((s, i) => s + i.qty, 0),
        });

        // Promoter hoodie: credit the promoter with what the customer saved
        // (store credit), and tally the hoodie's redemption. Skips self-buys.
        if (
          order.promoter_user_id &&
          order.discount_cents > 0 &&
          order.promoter_user_id !== order.customer_id
        ) {
          await admin.rpc("grant_store_credit", {
            p_user: order.promoter_user_id,
            p_amount: order.discount_cents,
            p_reason: "promoter_hoodie",
            p_ref_type: "shop_order",
            p_ref_id: order.id,
          });
          if (order.hoodie_code) {
            const { data: h } = await admin
              .from("promoter_hoodies")
              .select("redemptions, earned_cents")
              .eq("code", order.hoodie_code)
              .maybeSingle();
            if (h) {
              await admin
                .from("promoter_hoodies")
                .update({
                  redemptions: (h.redemptions ?? 0) + 1,
                  earned_cents: (h.earned_cents ?? 0) + order.discount_cents,
                })
                .eq("code", order.hoodie_code);
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
