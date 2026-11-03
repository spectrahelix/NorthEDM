import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, isSiteAdminUser, loadSplitSettings, recordSaleSplit } from "@/utils/coordinator";

// POST — the purse keeper (the shop's coordinator) or an admin confirms that a
// wallet payment arrived, or rejects it. Confirming moves the order into the
// vendor's queue and books the 90/10 sale split in the ledger.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : body.action === "confirm" ? "confirm" : null;
  if (!action) return NextResponse.json({ error: "action must be confirm or reject" }, { status: 400 });

  const admin = serviceClient();
  const { data: order } = await admin
    .from("festdash_orders")
    .select("id, vendor_id, status, payment_method, payment_ref, total_cents, runner_fee_cents, currency")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: vendor } = await admin.from("vendors").select("id, coordinator_user_id").eq("id", order.vendor_id).maybeSingle();
  const coordinatorId = (vendor?.coordinator_user_id as string | null) ?? null;
  const allowed = coordinatorId === user.id || (await isSiteAdminUser(admin, user));
  if (!allowed) return NextResponse.json({ error: "Only this shop's purse keeper can confirm payments." }, { status: 403 });
  if (order.status !== "awaiting_confirmation") {
    return NextResponse.json({ error: "This order isn't waiting for payment confirmation." }, { status: 409 });
  }

  const now = new Date().toISOString();
  if (action === "reject") {
    const { error } = await admin.from("festdash_orders")
      .update({ status: "declined", payment_status: "rejected", payment_confirmed_by: user.id, payment_confirmed_at: now, updated_at: now })
      .eq("id", id).eq("status", "awaiting_confirmation");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "declined" });
  }

  const { data: updated, error } = await admin.from("festdash_orders")
    .update({ status: "pending", payment_status: "paid_mobile", paid: true, payment_confirmed_by: user.id, payment_confirmed_at: now, updated_at: now })
    .eq("id", id).eq("status", "awaiting_confirmation")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Already handled." }, { status: 409 });

  if (coordinatorId) {
    const settings = await loadSplitSettings(admin);
    await recordSaleSplit(admin, {
      id: order.id, vendor_id: Number(order.vendor_id), total_cents: Number(order.total_cents), runner_fee_cents: Number(order.runner_fee_cents ?? 0),
      currency: String(order.currency || "USD"), payment_method: String(order.payment_method), payment_ref: order.payment_ref ?? null,
    }, coordinatorId, settings, user.id);
  }
  return NextResponse.json({ ok: true, status: "pending" });
}
