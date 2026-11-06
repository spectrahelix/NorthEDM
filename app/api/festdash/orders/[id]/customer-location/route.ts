import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";

/**
 * The customer's OPTIONAL live position for one delivery (owner, 2026-11-06).
 * Stored in festdash_customer_live (service role only), never on the order
 * row, so the shop can't see it.
 *
 * POST   { lat, lng }  the order's customer, while the delivery is open
 * DELETE               the customer stops sharing (row removed)
 * GET                  the customer, or the runner assigned to it while
 *                      in transit; a position older than 10 minutes is stale
 *                      and not returned
 */
const OPEN = ["pending", "accepted", "in_transit"];
const FRESH_MS = 10 * 60 * 1000;

async function load(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = serviceClient();
  const { data: order } = await admin.from("festdash_orders")
    .select("id, customer_id, driver_id, status, fulfillment").eq("id", id).maybeSingle();
  return { user, admin, order };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, order } = await load(id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!order || order.customer_id !== user.id) return NextResponse.json({ error: "Not your order." }, { status: 403 });
  if (!OPEN.includes(order.status) || order.fulfillment === "pickup") {
    return NextResponse.json({ error: "Live location is only for an open delivery." }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  const { error } = await admin.from("festdash_customer_live")
    .upsert({ order_id: id, lat, lng, updated_at: new Date().toISOString() }, { onConflict: "order_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, order } = await load(id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!order || order.customer_id !== user.id) return NextResponse.json({ error: "Not your order." }, { status: 403 });
  await admin.from("festdash_customer_live").delete().eq("order_id", id);
  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, order } = await load(id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isCustomer = !!order && order.customer_id === user.id;
  const isRunner = !!order && order.driver_id === user.id && order.status === "in_transit";
  if (!order || (!isCustomer && !isRunner)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { data } = await admin.from("festdash_customer_live").select("lat, lng, updated_at").eq("order_id", id).maybeSingle();
  const fresh = !!data && Date.now() - new Date(data.updated_at as string).getTime() < FRESH_MS;
  return NextResponse.json({ sharing: !!data, live: fresh ? { lat: data!.lat, lng: data!.lng, at: data!.updated_at } : null });
}
