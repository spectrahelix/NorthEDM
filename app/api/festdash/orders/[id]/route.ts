import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";

// Allowed status transitions — orders can't skip steps or move backwards.
const TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "declined"],
  accepted: ["in_transit", "delivered"],
  in_transit: ["delivered"],
  delivered: [],
  declined: [],
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status, code } = await req.json();

  const valid = ["accepted", "in_transit", "delivered", "declined"];
  if (!valid.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Load the order (RLS lets the owning vendor / assigned driver read it)
  const { data: order } = await supabase
    .from("festdash_orders")
    .select("id, vendor_id, driver_id, status, confirmation_code")
    .eq("id", id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Authorize: the order's vendor, or its assigned driver
  const { data: profile } = await supabase
    .from("profiles")
    .select("vendor_id")
    .eq("id", user.id)
    .single();

  const isVendor = !!profile?.vendor_id && profile.vendor_id === order.vendor_id;
  const isDriver = !!order.driver_id && order.driver_id === user.id;
  if (!isVendor && !isDriver) {
    return NextResponse.json({ error: "Not allowed to update this order" }, { status: 403 });
  }

  // Enforce a valid transition
  const allowed = TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Can't move an order from "${order.status}" to "${status}".` },
      { status: 409 }
    );
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  // Delivery must be confirmed with the customer's 4-digit code
  if (status === "delivered") {
    if (order.confirmation_code) {
      const supplied = String(code ?? "").replace(/\D/g, "").slice(-4);
      if (supplied !== order.confirmation_code) {
        return NextResponse.json({ error: "Incorrect confirmation code." }, { status: 422 });
      }
    }
    patch.confirmed_at = new Date().toISOString();
  }

  // RLS enforces vendor/driver ownership on the write
  const { error } = await supabase
    .from("festdash_orders")
    .update(patch)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Escrow settlement, tied to the new state:
  //   delivered → CAPTURE the authorized hold (funds move to the vendor, minus
  //               the 5% fee if a Connect account is attached).
  //   declined  → CANCEL the authorization (releases the hold; card untouched).
  // Best-effort and never reverses the delivery/decline that already happened —
  // a Stripe hiccup is recorded as *_failed for the owner to settle manually.
  if (status === "delivered" || status === "declined") {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: full } = await admin
      .from("festdash_orders")
      .select("stripe_payment_intent, payment_status")
      .eq("id", id)
      .maybeSingle();

    if (full?.stripe_payment_intent && full.payment_status === "authorized") {
      try {
        const stripe = getStripe();
        if (status === "delivered") {
          await stripe.paymentIntents.capture(full.stripe_payment_intent);
          await admin
            .from("festdash_orders")
            .update({ payment_status: "released", escrow_released_at: new Date().toISOString(), paid: true })
            .eq("id", id);
        } else {
          await stripe.paymentIntents.cancel(full.stripe_payment_intent);
          await admin
            .from("festdash_orders")
            .update({ payment_status: "canceled", paid: false })
            .eq("id", id);
        }
      } catch (e) {
        console.error("festdash escrow settle error:", e);
        await admin
          .from("festdash_orders")
          .update({ payment_status: status === "delivered" ? "capture_failed" : "cancel_failed" })
          .eq("id", id);
      }
    }
  }

  return NextResponse.json({ success: true });
}
