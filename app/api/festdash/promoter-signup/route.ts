import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await req.json();
  const { displayName, email, phone, audience, promoteVendor, why } = body;

  if (!displayName || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const { error } = await supabase.from("festdash_promoter_applications").insert([
    {
      display_name: displayName,
      email: String(email).toLowerCase().trim(),
      phone: phone || null,
      audience: audience || null,
      promote_vendor: promoteVendor || null,
      why: why || null,
      user_id: user?.id ?? null,
      status: "pending",
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
