import { NextResponse } from "next/server";
import { adminGuard, slugify } from "@/utils/admin";

// List all products (incl. inactive) for the admin manager.
export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { data, error } = await g.admin
    .from("shop_products").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

// Create a product.
export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const price_cents = Math.round(Number(b.priceCents));
  if (!Number.isFinite(price_cents) || price_cents < 0) {
    return NextResponse.json({ error: "Valid price required." }, { status: 400 });
  }

  // unique slug
  const base = slugify(name);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await g.admin.from("shop_products").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await g.admin.from("shop_products").insert({
    name, slug,
    description: String(b.description ?? ""),
    price_cents,
    inventory_count: Math.max(0, Math.round(Number(b.inventoryCount) || 0)),
    image_urls: Array.isArray(b.imageUrls) ? b.imageUrls.slice(0, 12) : [],
    category: b.category ? String(b.category) : null,
    active: b.active !== false,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}
