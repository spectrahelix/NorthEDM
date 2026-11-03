import { NextResponse } from "next/server";
import { guardStoreOperator } from "@/utils/store";

// GET — the operator's order list: what is held, paid, awaiting a wallet
// payment, and recently done. Service role after the operator check.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await guardStoreOperator(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { data } = await g.admin.from("store_orders")
    .select("id, status, items, subtotal_cents, total_cents, currency, payment_method, email, ship_name, ship_address, authorized_at, fulfilled_at, created_at")
    .eq("store_id", g.store.id).in("status", ["authorized", "paid", "awaiting_confirmation"])
    .order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ orders: data ?? [] });
}
