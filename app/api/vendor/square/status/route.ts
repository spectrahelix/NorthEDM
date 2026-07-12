import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Report the vendor's Square connection status (never returns the token).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prof } = await supabase.from("profiles").select("vendor_id").eq("id", user.id).single();
  const vendorId = prof?.vendor_id as number | undefined;
  if (!vendorId) return NextResponse.json({ connected: false });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: conn } = await admin
    .from("vendor_square_connections")
    .select("environment, location_id, last_synced_at, last_sync_status")
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (!conn) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    environment: conn.environment,
    location_id: conn.location_id,
    last_synced_at: conn.last_synced_at,
    last_sync_status: conn.last_sync_status,
  });
}
