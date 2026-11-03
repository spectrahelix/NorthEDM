import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveMyVendor } from "@/utils/myVendor";

// GET — the shop owner's own vendor, store and FestDash status for the My Shop hub.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await resolveMyVendor(user.id);
  if (!me) return NextResponse.json({ error: "No shop linked to this account" }, { status: 403 });
  const { data: counts } = await me.admin.from("products").select("id, is_public, status").eq("vendor_id", me.vendorId);
  const products = counts ?? [];
  return NextResponse.json({
    vendor: me.vendor, store: me.store ? { slug: me.store.slug, name: me.store.name, active: me.store.active, billing_status: me.store.billing_status, is_operator: me.store.is_operator } : null,
    festdash: me.festdash,
    products: { total: products.length, live: products.filter((p) => p.is_public && p.status === "published").length },
  });
}
