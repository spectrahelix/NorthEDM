import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";

// GET — the signed-in member's unused vouchers (one-time codes assigned to them).
// A used voucher drops out here on its own: times_redeemed has reached max.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await serviceClient().from("discount_codes")
    .select("id, code, percent_off, amount_off_cents, max_redemptions, times_redeemed, active, expires_at, assigned_at, note")
    .eq("assigned_to", user.id).eq("active", true).order("assigned_at", { ascending: false });
  const now = Date.now();
  const vouchers = (data ?? []).filter((c) =>
    (c.max_redemptions == null || Number(c.times_redeemed) < Number(c.max_redemptions)) &&
    (!c.expires_at || new Date(c.expires_at).getTime() > now));
  return NextResponse.json({ vouchers });
}
