import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canManageInventory } from "@/utils/marketplace";
import { runSquareSync, type SquareEnv } from "@/utils/square";

// Run a Square → NorthEDM sync now for the vendor's stored connection.
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
  const { data: conn } = await admin
    .from("vendor_square_connections")
    .select("vendor_id, access_token, location_id, environment")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (!conn) return NextResponse.json({ error: "Square isn't connected yet." }, { status: 400 });

  try {
    const result = await runSquareSync(admin, {
      vendor_id: conn.vendor_id,
      access_token: conn.access_token,
      location_id: conn.location_id,
      environment: conn.environment as SquareEnv,
    });
    return NextResponse.json({ ok: true, sync: result });
  } catch (e) {
    console.error("square sync error:", e);
    const msg = new Date().toISOString();
    await admin
      .from("vendor_square_connections")
      .update({ last_sync_status: `error at ${msg}`, updated_at: msg })
      .eq("vendor_id", vendorId);
    return NextResponse.json({ error: "Sync failed — check your Square token / location." }, { status: 502 });
  }
}
