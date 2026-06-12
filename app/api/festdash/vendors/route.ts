import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Try festdash_vendors table; fall back to all approved vendors if migration not yet run
  const { data: fdVendors, error } = await supabase
    .from("festdash_vendors")
    .select("vendor_id, vendors(id, name, category, description)")
    .eq("is_active", true);

  if (error) {
    // Migration not run yet — return all approved vendors as fallback
    const { data: allVendors } = await supabase
      .from("vendors")
      .select("id, name, category, description")
      .eq("status", "approved");
    return NextResponse.json({ vendors: allVendors ?? [], fallback: true });
  }

  const vendors = (fdVendors ?? []).map((row: Record<string, unknown>) => row.vendors).filter(Boolean);
  return NextResponse.json({ vendors, fallback: false });
}
