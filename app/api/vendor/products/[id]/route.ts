import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canManageInventory } from "@/utils/marketplace";

async function getVendorId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from("profiles")
    .select("vendor_id")
    .eq("id", userId)
    .single();
  return data?.vendor_id ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendorId = await getVendorId(supabase, user.id);
  if (!vendorId) {
    return NextResponse.json({ error: "No vendor linked to this account" }, { status: 403 });
  }
  if (!(await canManageInventory(supabase, user))) {
    return NextResponse.json({ error: "Marketplace access required." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Square-synced products are managed in Square (read-only here).
  const { data: existing } = await supabase
    .from("products").select("source").eq("id", Number(id)).eq("vendor_id", vendorId).maybeSingle();
  if (existing?.source === "square") {
    return NextResponse.json({ error: "This product is synced from Square — edit it in your Square dashboard." }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("products")
    .update({
      name: String(body.name ?? "").trim(),
      category: String(body.category ?? "").trim(),
      description: String(body.description ?? "").trim(),
      price: Number(body.price) || 0,
      inventory_count: Number(body.inventoryCount) || 0,
      image_url: body.imageUrl || null,
      is_public: body.isPublic ?? false,
      status: body.status || "draft",
    })
    .eq("id", Number(id))
    .eq("vendor_id", vendorId) // ownership enforced at DB level
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendorId = await getVendorId(supabase, user.id);
  if (!vendorId) {
    return NextResponse.json({ error: "No vendor linked to this account" }, { status: 403 });
  }
  if (!(await canManageInventory(supabase, user))) {
    return NextResponse.json({ error: "Marketplace access required." }, { status: 403 });
  }

  const { id } = await params;

  // Square-synced products are managed in Square — disconnect Square to remove them.
  const { data: existing } = await supabase
    .from("products").select("source").eq("id", Number(id)).eq("vendor_id", vendorId).maybeSingle();
  if (existing?.source === "square") {
    return NextResponse.json({ error: "This product is synced from Square — remove it in Square, or disconnect Square." }, { status: 409 });
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", Number(id))
    .eq("vendor_id", vendorId); // ownership enforced at DB level

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
