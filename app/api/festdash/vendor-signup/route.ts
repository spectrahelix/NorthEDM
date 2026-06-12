import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await req.json();
  const { businessName, contactName, email, phone, productTypes, typicalEvents, hasTablet, notes } = body;

  if (!businessName || !contactName || !email || !productTypes) {
    return NextResponse.json({ error: "Required fields missing." }, { status: 400 });
  }

  // If the user is logged in and has a vendor_id, link directly
  let vendorId: number | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("vendor_id")
      .eq("id", user.id)
      .single();
    vendorId = profile?.vendor_id ?? null;
  }

  const { error } = await supabase.from("festdash_vendor_applications").insert([
    {
      business_name: businessName,
      contact_name: contactName,
      email: email.toLowerCase().trim(),
      phone: phone || null,
      product_types: productTypes,
      typical_events: typicalEvents || null,
      has_tablet: hasTablet || null,
      notes: notes || null,
      vendor_id: vendorId,
      user_id: user?.id ?? null,
      status: "pending",
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
