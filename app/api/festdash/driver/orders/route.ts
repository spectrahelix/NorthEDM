import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// What a runner may see. The open pool shows only what's needed to decide
// whether to take the job; a claimed order adds what's needed to find the
// customer. Never included: the customer's phone, email, private handoff codes,
// or the payment / promo fields.
const POOL_COLUMNS =
  "id, vendor_id, event_name, campground, sub_campground, campground_zone, delivery_window, items, total_cents, runner_fee_cents, currency, payment_method, status, driver_id, created_at, updated_at";
const MINE_COLUMNS =
  `${POOL_COLUMNS}, customer_name, campsite_row, tent, campsite_notes, campsite_photo_url, car_photo_url, license_plate, customer_lat, customer_lng, driver_lat, driver_lng, location_updated_at`;

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
    .select(POOL_COLUMNS)
    .eq("status", "accepted")
    .eq("fulfillment", "delivery")
    .is("driver_id", null)
    .order("created_at", { ascending: true });

  const { data: mine } = await admin
    .from("festdash_orders")
    .select(MINE_COLUMNS)
    .eq("driver_id", user.id)
    .in("status", ["accepted", "in_transit"])
    .order("created_at", { ascending: true });

  return NextResponse.json({ available: available ?? [], mine: mine ?? [] });
}
