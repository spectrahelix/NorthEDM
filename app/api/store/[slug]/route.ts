import { NextResponse } from "next/server";
import { guardStoreOperator } from "@/utils/store";

// Operator (or NorthEDM admin) manages a store: branding + member vendors.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await guardStoreOperator(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const [{ data: store }, { data: members }, { data: allVendors }] = await Promise.all([
    g.admin.from("stores").select("*").eq("id", g.store.id).single(),
    g.admin.from("store_vendors").select("vendor_id, status, added_at").eq("store_id", g.store.id),
    g.admin.from("vendors").select("id, name, category").eq("status", "approved").order("name"),
  ]);

  const memberIds = new Set((members ?? []).map((m) => m.vendor_id));
  const nameById = new Map((allVendors ?? []).map((v) => [v.id, { name: v.name, category: v.category }]));
  const memberVendors = (members ?? []).map((m) => ({
    vendor_id: m.vendor_id,
    status: m.status,
    name: nameById.get(m.vendor_id)?.name ?? `Vendor ${m.vendor_id}`,
    category: nameById.get(m.vendor_id)?.category ?? null,
  }));
  const availableVendors = (allVendors ?? []).filter((v) => !memberIds.has(v.id));

  return NextResponse.json({ store, memberVendors, availableVendors });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await guardStoreOperator(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "branding") {
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
    if (typeof body.tagline === "string") patch.tagline = body.tagline.trim().slice(0, 200) || null;
    if (/^#[0-9a-fA-F]{6}$/.test(String(body.accentColor))) patch.accent_color = body.accentColor;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    const { error } = await g.admin.from("stores").update(patch).eq("id", g.store.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "addVendor") {
    const vendorId = Math.round(Number(body.vendorId) || 0);
    if (!vendorId) return NextResponse.json({ error: "Pick a vendor." }, { status: 400 });
    const { error } = await g.admin.from("store_vendors").upsert(
      { store_id: g.store.id, vendor_id: vendorId, status: "approved" },
      { onConflict: "store_id,vendor_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "removeVendor") {
    const vendorId = Math.round(Number(body.vendorId) || 0);
    const { error } = await g.admin.from("store_vendors").delete().eq("store_id", g.store.id).eq("vendor_id", vendorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
