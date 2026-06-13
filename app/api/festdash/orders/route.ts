import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    vendorId, eventName, campgroundZone, campsiteNotes,
    campsitePhotoUrl, deliveryWindow, items, totalCents, customerName,
  } = body;

  if (!vendorId || !eventName || !campgroundZone || !deliveryWindow || !items?.length) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("festdash_orders")
    .insert([{
      vendor_id: Number(vendorId),
      customer_id: user.id,
      customer_name: customerName || user.email?.split("@")[0] || "Guest",
      customer_email: user.email,
      event_name: eventName,
      campground_zone: campgroundZone,
      campsite_notes: campsiteNotes || null,
      campsite_photo_url: campsitePhotoUrl || null,
      delivery_window: deliveryWindow,
      items,
      total_cents: Number(totalCents) || 0,
      status: "pending",
      paid: false,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ order: data });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("festdash_orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [] });
}
