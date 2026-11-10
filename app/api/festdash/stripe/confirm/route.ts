import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";
import { recordFestdashAuthorization } from "@/utils/festdashSettlement";

// Confirm fallback for the Checkout return (success_url → /festdash/track/:id).
// The webhook is the primary promoter, but this lets an order go live even if
// the webhook secret isn't configured yet or the event is delayed. Idempotent:
// it retrieves the order's Checkout session and, if the card is authorized,
// promotes "awaiting_payment" → "pending". Safe to call repeatedly.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: "Missing orderId." }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: order } = await admin
    .from("festdash_orders")
    .select("id, customer_id, status, payment_status, stripe_checkout_session")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  // Only the customer who placed it may trigger their own confirm.
  if (order.customer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Already live (webhook won the race, or credit-covered) — nothing to do.
  if (order.status !== "awaiting_payment") {
    return NextResponse.json({ ok: true, status: order.status, payment_status: order.payment_status });
  }
  if (!order.stripe_checkout_session) {
    return NextResponse.json({ ok: false, status: order.status });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session, {
      expand: ["payment_intent"],
    });
    const pi = session.payment_intent as { id: string; status: string } | null;
    const authorized =
      session.status === "complete" &&
      !!pi &&
      (pi.status === "requires_capture" || pi.status === "succeeded");

    if (authorized) {
      const result = await recordFestdashAuthorization(admin, orderId, pi!.id);
      return NextResponse.json({ ok: result.status !== "awaiting_payment", ...result });
    }

    return NextResponse.json({ ok: false, status: order.status, payment_status: order.payment_status });
  } catch (e) {
    console.error("festdash confirm error:", e);
    return NextResponse.json({ ok: false, error: "Could not confirm payment yet." }, { status: 502 });
  }
}
