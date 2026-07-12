import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canManageInventory } from "@/utils/marketplace";

// Disconnect Square: remove the stored token/connection and hide the products
// that came from Square (kept as drafts, not deleted, so nothing is lost).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prof } = await supabase.from("profiles").select("vendor_id").eq("id", user.id).single();
  const vendorId = prof?.vendor_id as number | undefined;
  if (!vendorId) return NextResponse.json({ error: "No vendor linked to this account" }, { status: 403 });
  if (!(await canManageInventory(supabase, user))) {
    return NextResponse.json({ error: "Marketplace access required." }, { status: 403 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await admin.from("vendor_square_connections").delete().eq("vendor_id", vendorId);
  await admin
    .from("products")
    .update({ is_public: false, status: "draft" })
    .eq("vendor_id", vendorId)
    .eq("source", "square");

  return NextResponse.json({ ok: true });
}
