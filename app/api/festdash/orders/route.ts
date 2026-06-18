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
    customerPhone, campground, subCampground, campsiteRow, tent,
    licensePlate, carPhotoUrl, customerLat, customerLng,
  } = body;

  if (!vendorId || !eventName || !campgroundZone || !deliveryWindow || !items?.length) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // Delivery confirmation code = last 4 digits of the customer's phone
  const phoneDigits = String(customerPhone ?? "").replace(/\D/g, "");
  const confirmationCode = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : null;

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
      campground: campground || null,
      sub_campground: subCampground || null,
      campsite_row: campsiteRow || null,
      tent: tent || null,
      car_photo_url: carPhotoUrl || null,
      license_plate: licensePlate || null,
      customer_phone: customerPhone || null,
      confirmation_code: confirmationCode,
      customer_lat: typeof customerLat === "number" ? customerLat : null,
      customer_lng: typeof customerLng === "number" ? customerLng : null,
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
