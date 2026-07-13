import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// The logged-in promoter's own hoodies + totals. Read via service role scoped to
// their user id (promoter_hoodies is service-role only).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: hoodies } = await admin
    .from("promoter_hoodies")
    .select("id, code, label, percent_off, active, scans, redemptions, earned_cents")
    .eq("promoter_user_id", user.id)
    .order("created_at", { ascending: false });

  const list = hoodies ?? [];
  const totals = list.reduce(
    (t, h) => ({
      hoodies: t.hoodies + 1,
      scans: t.scans + (h.scans ?? 0),
      redemptions: t.redemptions + (h.redemptions ?? 0),
      earned_cents: t.earned_cents + (h.earned_cents ?? 0),
    }),
    { hoodies: 0, scans: 0, redemptions: 0, earned_cents: 0 }
  );

  return NextResponse.json({ hoodies: list, totals });
}
