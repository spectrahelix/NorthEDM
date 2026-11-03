import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { storeAdminClient } from "@/utils/store";
import { isSiteAdminUser, loadSplitSettings, recordSaleSplit } from "@/utils/coordinator";

// POST — the coordinator (or an admin) confirms a store order's wallet payment
// arrived, or rejects it. Confirming marks it paid, takes the stock down and
// books the 90/10 sale split in the coordinator's ledger — the same moment the
// Stripe webhook handles for a card order.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : body.action === "confirm" ? "confirm" : null;
  if (!action) return NextResponse.json({ error: "action must be confirm or reject" }, { status: 400 });

  const admin = storeAdminClient();
  const { data: order } = await admin
    .from("store_orders")
    .select("id, store_id, vendor_id, status, items, subtotal_cents, total_cents, currency, payment_method, payment_ref")
    .eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const { data: vendor } = order.vendor_id ? await admin.from("vendors").select("coordinator_user_id").eq("id", order.vendor_id).maybeSingle() : { data: null };
  const coordinatorId = (vendor?.coordinator_user_id as string | null) ?? null;
  const allowed = coordinatorId === user.id || (await isSiteAdminUser(admin, user));
  if (!allowed) return NextResponse.json({ error: "Only this store's purse keeper can confirm payments." }, { status: 403 });
  if (order.status !== "awaiting_confirmation") return NextResponse.json({ error: "This order isn't waiting for payment confirmation." }, { status: 409 });

  const now = new Date().toISOString();
  if (action === "reject") {
    const { error } = await admin.from("store_orders")
      .update({ status: "canceled", payment_confirmed_by: user.id, payment_confirmed_at: now, updated_at: now })
      .eq("id", id).eq("status", "awaiting_confirmation");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "canceled" });
  }

  const { data: updated, error } = await admin.from("store_orders")
    .update({ status: "paid", payment_confirmed_by: user.id, payment_confirmed_at: now, updated_at: now })
    .eq("id", id).eq("status", "awaiting_confirmation").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Already handled." }, { status: 409 });

  // Stock comes down only once the money is confirmed (idempotent via the status guard above).
  const items = (order.items ?? []) as { product_id: number; qty: number }[];
  for (const it of items) {
    const { data: p } = await admin.from("products").select("inventory_count").eq("id", it.product_id).maybeSingle();
    if (p) await admin.from("products").update({ inventory_count: Math.max(0, (p.inventory_count ?? 0) - it.qty) }).eq("id", it.product_id);
  }
  if (coordinatorId && order.vendor_id) {
    const settings = await loadSplitSettings(admin);
    await recordSaleSplit(admin, {
      id: order.id, vendor_id: Number(order.vendor_id), total_cents: Number(order.subtotal_cents ?? order.total_cents), runner_fee_cents: 0,
      currency: String(order.currency || "GMD"), payment_method: String(order.payment_method), payment_ref: order.payment_ref ?? null, source: "store",
    }, coordinatorId, settings, user.id);
  }
  return NextResponse.json({ ok: true, status: "paid" });
}
