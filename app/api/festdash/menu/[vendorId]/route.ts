import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const supabase = await createClient();
  const { vendorId } = await params;

  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, category, inventory_count")
    .eq("vendor_id", Number(vendorId))
    .eq("is_public", true)
    .eq("status", "published")
    .gt("inventory_count", 0)
    .order("category");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}
