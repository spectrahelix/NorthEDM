import { shieldForm } from "@/utils/botSignals";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

import { notifyNewRunner } from "@/utils/alerts";
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

  const body = await req.json().catch(() => ({}));
  const { displayName, phone, vehicle } = body;
  const shield = await shieldForm(req, body, "driver-register");
  if (shield.verdict !== "ok") return shield.response;
  if (!displayName?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // A first registration alerts the owner; editing an existing one does not.
  const { data: existing } = await supabase
    .from("festdash_drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // `is_active` is deliberately not sent: new runners start inactive and only
  // the owner switches them on (/admin/festdash). The database enforces this
  // as well (protect_runner_activation), so a direct call can't self-activate.
  const { data, error } = await supabase
    .from("festdash_drivers")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName.trim(),
        phone: phone?.trim() || null,
        vehicle: vehicle?.trim() || null,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!existing) {
    await notifyNewRunner({ name: data.display_name, email: user.email ?? null, vehicle: data.vehicle ?? null });
  }
  await shield.record();
  return NextResponse.json({ driver: data });
}
