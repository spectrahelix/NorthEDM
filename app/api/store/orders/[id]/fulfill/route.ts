import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { storeAdminClient } from "@/utils/store";
import { isSiteAdminUser } from "@/utils/coordinator";
import { getStripe } from "@/utils/stripe";
import { cancelStoreHold, settleStoreOrder } from "@/utils/storeSettle";
import { sendOrderEmails } from "@/utils/orderEmails";

// POST { action: "handed_over" | "cancel" } — the store's operator (or an admin)
// completes or cancels an order. A held card (Gambian store) is captured only
// at handover; cancelling releases it and restores stock. That is the whole
// point: a dispute can't land on a sale that never left the counter.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === "cancel" ? "cancel" : body.action === "handed_over" ? "handed_over" : null;
  if (!action) return NextResponse.json({ error: "action must be handed_over or cancel" }, { status: 400 });

  const admin = storeAdminClient();
  const { data: order } = await admin.from("store_orders").select("id, store_id, status, stripe_payment_intent, items, fulfilled_at").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const { data: store } = await admin.from("stores").select("owner_user_id").eq("id", order.store_id).maybeSingle();
  const allowed = store?.owner_user_id === user.id || (await isSiteAdminUser(admin, user));
  if (!allowed) return NextResponse.json({ error: "Not your store." }, { status: 403 });
  const now = new Date().toISOString();

  if (action === "cancel") {
    if (order.status === "authorized") {
      const ok = await cancelStoreHold(admin, id, `cancelled by ${user.id}`);
      return ok ? NextResponse.json({ ok: true, status: "canceled" }) : NextResponse.json({ error: "Couldn't release the hold." }, { status: 409 });
    }
    if (order.status === "awaiting_confirmation" || order.status === "pending") {
      await admin.from("store_orders").update({ status: "canceled", updated_at: now }).eq("id", id).in("status", ["awaiting_confirmation", "pending"]);
      return NextResponse.json({ ok: true, status: "canceled" });
    }
    return NextResponse.json({ error: "A paid order can't be cancelled here — refund it from Stripe." }, { status: 409 });
  }

  // handed_over
  if (order.status === "authorized") {
    if (!order.stripe_payment_intent) return NextResponse.json({ error: "No card hold on this order." }, { status: 409 });
    try { await getStripe().paymentIntents.capture(order.stripe_payment_intent as string); }
    catch (e) { return NextResponse.json({ error: `Card capture failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 }); }
    const { data: upd } = await admin.from("store_orders").update({ status: "paid", paid_at: now, fulfilled_at: now, updated_at: now }).eq("id", id).eq("status", "authorized").select("id").maybeSingle();
    if (!upd) return NextResponse.json({ error: "Already handled." }, { status: 409 });
    await settleStoreOrder(admin, id);
    return NextResponse.json({ ok: true, status: "paid", captured: true });
  }
  if (order.status === "paid") {
    if (!order.fulfilled_at) await admin.from("store_orders").update({ fulfilled_at: now, updated_at: now }).eq("id", id);
    return NextResponse.json({ ok: true, status: "paid" });
  }
  return NextResponse.json({ error: `Can't hand over an order that is ${order.status}.` }, { status: 409 });
}
