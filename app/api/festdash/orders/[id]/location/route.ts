import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// POST — the assigned runner pushes their live GPS position for an order.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { lat, lng } = await req.json();

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  // RLS ("Drivers update assigned orders") restricts this to the order's runner
  const { data, error } = await supabase
    .from("festdash_orders")
    .update({
      driver_lat: latNum,
      driver_lng: lngNum,
      location_updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("driver_id", user.id)
    .eq("status", "in_transit")
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not your active delivery" }, { status: 403 });

  return NextResponse.json({ success: true });
}
