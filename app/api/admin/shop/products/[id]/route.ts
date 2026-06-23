import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.name !== undefined) patch.name = String(b.name).trim();
  if (b.description !== undefined) patch.description = String(b.description);
  if (b.priceCents !== undefined) patch.price_cents = Math.max(0, Math.round(Number(b.priceCents)));
  if (b.inventoryCount !== undefined) patch.inventory_count = Math.max(0, Math.round(Number(b.inventoryCount)));
  if (b.imageUrls !== undefined) patch.image_urls = Array.isArray(b.imageUrls) ? b.imageUrls.slice(0, 12) : [];
  if (b.category !== undefined) patch.category = b.category ? String(b.category) : null;
  if (b.active !== undefined) patch.active = !!b.active;

  const { data, error } = await g.admin
    .from("shop_products").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;
  const { error } = await g.admin.from("shop_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
