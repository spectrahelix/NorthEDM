import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

const ALLOWED = ["pending", "paid", "fulfilled", "cancelled", "refunded"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!ALLOWED.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    patch.status = body.status;
    if (body.status === "fulfilled") patch.fulfilled_at = new Date().toISOString();
  }
  if (body.tracking_number !== undefined) patch.tracking_number = String(body.tracking_number ?? "").trim().slice(0, 64) || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const { data, error } = await g.admin
    .from("shop_orders").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
