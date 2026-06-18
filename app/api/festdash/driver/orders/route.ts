import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — orders a driver can act on: the open pool + their own deliveries.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Must be a registered, active driver
  const { data: driver } = await supabase
    .from("festdash_drivers")
    .select("id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver || !driver.is_active) {
    return NextResponse.json({ error: "Not a registered driver" }, { status: 403 });
  }

  // Service role: the pool includes orders from any vendor (RLS would hide them)
  const admin = getAdminClient();

  const { data: available } = await admin
    .from("festdash_orders")
    .select("*")
    .eq("status", "accepted")
    .is("driver_id", null)
    .order("created_at", { ascending: true });

  const { data: mine } = await admin
    .from("festdash_orders")
    .select("*")
    .eq("driver_id", user.id)
    .in("status", ["accepted", "in_transit"])
    .order("created_at", { ascending: true });

  return NextResponse.json({ available: available ?? [], mine: mine ?? [] });
}
