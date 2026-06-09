import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

async function getVendorId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from("profiles")
    .select("vendor_id")
    .eq("id", userId)
    .single();
  return data?.vendor_id ?? null;
}

export async function GET() {
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

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}

export async function POST(req: Request) {
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

  const body = await req.json();

  const { data, error } = await supabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        name: String(body.name ?? "").trim(),
        category: String(body.category ?? "").trim(),
        description: String(body.description ?? "").trim(),
        price: Number(body.price) || 0,
        inventory_count: Number(body.inventoryCount) || 0,
        image_url: body.imageUrl || null,
        is_public: body.isPublic ?? false,
        status: body.status || "draft",
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}
