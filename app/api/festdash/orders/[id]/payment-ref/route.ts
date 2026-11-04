import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { isWalletMethod } from "@/utils/gambiaPay";

// POST — the customer records the transaction reference from their wallet app
// so the purse keeper can match the payment. Ordinary sessions can't update
// order rows directly, so this goes through the service role after the
// ownership check.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const ref = String(body.ref ?? "").trim().slice(0, 64);
  if (!ref) return NextResponse.json({ error: "Enter the transaction reference from your wallet app." }, { status: 400 });

  // RLS: a customer can read only their own orders.
  const { data: order } = await supabase
    .from("festdash_orders")
    .select("id, status, payment_method, customer_id")
    .eq("id", id)
    .maybeSingle();
  if (!order || order.customer_id !== user.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "awaiting_confirmation" || !isWalletMethod(order.payment_method)) {
    return NextResponse.json({ error: "This order isn't waiting for a wallet payment." }, { status: 409 });
  }

  const { error } = await serviceClient().from("festdash_orders").update({ payment_ref: ref, payment_ref_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
