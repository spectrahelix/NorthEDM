import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — a registered driver claims an available (accepted, unassigned) order.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: driver } = await supabase
    .from("festdash_drivers")
    .select("id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver || !driver.is_active) {
    return NextResponse.json({ error: "You must register as a driver first." }, { status: 403 });
  }

  const { id } = await params;
  const admin = getAdminClient();

  // Conditional update = race guard: only the first claimer matches
  // (status still 'accepted' AND driver_id still null).
  const { data, error } = await admin
    .from("festdash_orders")
    .update({ driver_id: user.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "accepted")
    .is("driver_id", null)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "Order already claimed or no longer available." }, { status: 409 });
  }

  return NextResponse.json({ order: data });
}
