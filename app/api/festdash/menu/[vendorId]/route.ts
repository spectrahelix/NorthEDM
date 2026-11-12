import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { IN_STOCK_FILTER } from "@/utils/stock";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const supabase = await createClient();
  const { vendorId } = await params;
  const id = Number(vendorId);

  const [{ data, error }, { data: seller }] = await Promise.all([
    supabase.from("products")
      .select("id, name, description, price, image_url, category, inventory_count")
      .eq("vendor_id", id)
      .eq("is_public", true)
      .eq("status", "published")
      .or(IN_STOCK_FILTER)
      .order("category"),
    supabase.from("vendors").select("user_id").eq("id", id)
      .eq("is_public", true).eq("status", "approved").is("suspended_at", null).maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [], canMessageSeller: !!seller?.user_id });
}
