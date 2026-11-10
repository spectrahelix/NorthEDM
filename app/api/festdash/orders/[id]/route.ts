import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { ensureFestdashHandoff } from "@/utils/festdashHandoff";
import { settleFestdashOrder } from "@/utils/festdashSettlement";

const TRANSITIONS: Record<string, string[]> = {
  awaiting_payment: ["declined"], awaiting_confirmation: ["declined"],
  pending: ["accepted", "declined"], accepted: ["in_transit", "declined"],
  in_transit: ["declined"], delivered: [], declined: [],
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status } = body;
  if (status === "delivered") return NextResponse.json({ error: "Use the secure two-way handoff. Both the customer and Dasher must confirm from their own accounts." }, { status: 409 });
  if (!["accepted", "in_transit", "declined"].includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const admin = serviceClient();
  const { data: order, error } = await admin.from("festdash_orders")
    .select("id, vendor_id, customer_id, driver_id, status, fulfillment").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Order records are unavailable." }, { status: 503 });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const [{ data: profile }, { data: vendor }, { data: driver }] = await Promise.all([
    admin.from("user_profiles").select("vendor_id").eq("id", user.id).maybeSingle(),
    admin.from("vendors").select("user_id").eq("id", order.vendor_id).maybeSingle(),
    admin.from("festdash_drivers").select("is_active").eq("user_id", user.id).maybeSingle(),
  ]);
  const isVendor = profile?.vendor_id === order.vendor_id || vendor?.user_id === user.id;
  const isDriver = order.driver_id === user.id && driver?.is_active;
  const isCustomer = order.customer_id === user.id;
  const customerMayCancel = isCustomer && status === "declined" && ["awaiting_payment", "awaiting_confirmation", "pending"].includes(order.status);
  if (!isVendor && !isDriver && !customerMayCancel) return NextResponse.json({ error: "Not allowed to update this order." }, { status: 403 });
  if (status === "accepted" && !isVendor) return NextResponse.json({ error: "Only the shop can accept an order." }, { status: 403 });
  if (status === "in_transit" && !(order.fulfillment === "pickup" ? isVendor : isDriver)) return NextResponse.json({ error: "Only the assigned Dasher can start delivery (or the shop can mark a pickup ready)." }, { status: 403 });
  if (!(TRANSITIONS[order.status] ?? []).includes(status)) return NextResponse.json({ error: `Cannot move this order from ${order.status} to ${status}.` }, { status: 409 });
  // Ensure a durable reconciliation record before closing a legacy order too.
  try { await ensureFestdashHandoff(admin, id); }
  catch { return NextResponse.json({ error: "Secure payment records are unavailable. No status change was made." }, { status: 503 }); }
  const { data: changed, error: writeError } = await admin.from("festdash_orders")
    .update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("status", order.status).select("id").maybeSingle();
  if (writeError) return NextResponse.json({ error: "Order could not be updated." }, { status: 503 });
  if (!changed) return NextResponse.json({ error: "The order changed. Refresh before trying again." }, { status: 409 });
  if (status === "declined") {
    await admin.from("festdash_customer_live").delete().eq("order_id", id);
    const settlement = await settleFestdashOrder(admin, id);
    return NextResponse.json({ success: true, payment_status: settlement.status, payment_pending: settlement.pending });
  }
  return NextResponse.json({ success: true });
}
