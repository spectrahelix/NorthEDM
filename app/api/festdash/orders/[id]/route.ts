import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";
import { checkWrite } from "@/utils/dbWrite";

import { loadSplitSettings, recordSaleSplit } from "@/utils/coordinator";
import { isLocalRail } from "@/utils/gambiaPay";
import { recordCommission, commissionTerms } from "@/utils/commissions";
import { payRunnerFee } from "@/utils/runnerPay";
// Allowed status transitions — orders can't skip steps or move backwards.
const TRANSITIONS: Record<string, string[]> = {
  awaiting_confirmation: ["declined"],
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
    .select("id, vendor_id, driver_id, status, confirmation_code, payment_method, total_cents, runner_fee_cents, currency, payment_ref")
    .eq("id", id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Authorize: the order's vendor, or its assigned driver
  const { data: profile } = await supabase
    .from("user_profiles")
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

  // The write goes through the service role: ordinary sessions can no longer
  // update order rows directly (only the assigned runner's GPS columns), so
  // every state change has to pass the checks above. Ownership was verified
  // against the RLS-filtered read.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error } = await admin
    .from("festdash_orders")
    .update(patch)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cash on delivery: the handover is the payment. Mark it collected and book
  // the split for the shop's coordinator (idempotent per order).
  if (status === "delivered" && order.payment_method === "cash") {
    await admin
      .from("festdash_orders")
      .update({ payment_status: "paid_cash", paid: true, payment_confirmed_by: user.id, payment_confirmed_at: new Date().toISOString() })
      .eq("id", id);
    const { data: v } = await admin.from("vendors").select("coordinator_user_id").eq("id", order.vendor_id).maybeSingle();
    if (v?.coordinator_user_id) {
      const settings = await loadSplitSettings(admin);
      await recordSaleSplit(admin, {
        id, vendor_id: Number(order.vendor_id), total_cents: Number(order.total_cents), runner_fee_cents: Number(order.runner_fee_cents ?? 0),
        currency: String(order.currency || "USD"), payment_method: "cash", payment_ref: order.payment_ref ?? null,
      }, v.coordinator_user_id as string, settings, user.id);
    }
  }

  // Escrow settlement, tied to the new state:
  //   delivered → CAPTURE the authorized hold (funds move to the vendor, minus
  //               FestDash's share if a Connect account is attached), then book
  //               the coordinator's part of that share as a held commission.
  //   declined  → CANCEL the authorization (releases the hold; card untouched).
  // Best-effort and never reverses the delivery/decline that already happened —
  // a Stripe hiccup is recorded as *_failed for the owner to settle manually.
  if (status === "delivered" || status === "declined") {
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
          // The capture above has ALREADY moved the customer's money to the
          // vendor. If this write is lost the order never shows as released,
          // and nothing anywhere says so — the worst shape a silent failure
          // can take.
          await checkWrite(
            `escrow released for order ${id}`,
            await admin
              .from("festdash_orders")
              .update({ payment_status: "released", escrow_released_at: new Date().toISOString(), paid: true })
              .eq("id", id),
            { critical: true }
          );
          const { data: vend } = await admin
            .from("vendors").select("coordinator_user_id, user_id, currency").eq("id", order.vendor_id).maybeSingle();
          if (vend && isLocalRail(vend)) {
            // Card on a Gambian shop: the whole charge sits with NorthEDM.
            // Stripe can't reach the shop or the runner, so book the 80/10/10
            // plus the runner fee as owed BY the owner to the coordinator, who
            // pays the shop and runner locally. Settled by Remitly from
            // /admin/festdash/coordinators ("Sent by Remitly").
            const settings = await loadSplitSettings(admin);
            await recordSaleSplit(admin, {
              id, vendor_id: Number(order.vendor_id), total_cents: Number(order.total_cents), runner_fee_cents: Number(order.runner_fee_cents ?? 0),
              currency: String(order.currency || vend.currency || "USD"), payment_method: "card", payment_ref: full.stripe_payment_intent, collected_by: "owner",
            }, vend.coordinator_user_id as string, settings, user.id);
          } else {
          // The runner's fee, in full, to the runner's payout account (or the
          // daily cron pays it once they set payouts up).
          await payRunnerFee(admin, id);
          // The coordinator's share of a card sale (sale_coordinator_bps of the
          // amount charged) is owed to them out of the platform fee just taken.
          // It is booked as a held commission and paid by the daily release
          // cron through Stripe Connect once the refund window closes — the
          // same path promoter commissions take, idempotent per order. A vendor
          // with no coordinator leaves that share with NorthEDM.
          if (vend?.coordinator_user_id) {
            const splits = await loadSplitSettings(admin);
            const { holdDays } = await commissionTerms(admin, "festdash_order");
            await recordCommission(admin, {
              promoterUserId: vend.coordinator_user_id as string,
              referredUserId: (vend.user_id as string | null) ?? null,
              source: "festdash_order",
              sourceId: id,
              baseCents: Number(order.total_cents) - Number(order.runner_fee_cents ?? 0),
              rateBps: splits.sale_coordinator_bps,
              holdDays,
            });
          }
          }
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
