import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

const ALLOWED = ["pending", "paid", "fulfilled", "cancelled", "refunded"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!ALLOWED.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const { data, error } = await g.admin
    .from("shop_orders").update({ status }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
