import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET — the current user's driver profile (or null if not registered)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("festdash_drivers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ driver: data ?? null });
}

// POST — register as a driver (or update your profile)
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { displayName, phone, vehicle } = await req.json();
  if (!displayName?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("festdash_drivers")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName.trim(),
        phone: phone?.trim() || null,
        vehicle: vehicle?.trim() || null,
        is_active: true,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ driver: data });
}
