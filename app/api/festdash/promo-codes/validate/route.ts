import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Validates a commission code for a given vendor + subtotal and returns the
// discount it would apply. Read-only preview — the order route re-validates
// and is the source of truth. Lookup uses the service role since the SELECT
// policy on festdash_promo_codes only exposes a code to its owner.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, vendorId, subtotalCents } = await req.json().catch(() => ({}));
  if (!code || !vendorId) {
    return NextResponse.json({ error: "Missing code or vendor." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: row } = await admin
    .from("festdash_promo_codes")
    .select("id, percent_off, vendor_id, active, expires_at, max_redemptions, times_redeemed")
    .ilike("code", String(code).trim())
    .maybeSingle();

  if (!row || !row.active || row.vendor_id !== Number(vendorId)) {
    return NextResponse.json({ valid: false, error: "Invalid code for this vendor." }, { status: 200 });
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: "This code has expired." }, { status: 200 });
  }
  if (row.max_redemptions != null && row.times_redeemed >= row.max_redemptions) {
    return NextResponse.json({ valid: false, error: "This code has been fully redeemed." }, { status: 200 });
  }

  const sub = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const discountCents = Math.floor((sub * row.percent_off) / 100);

  return NextResponse.json({
    valid: true,
    codeId: row.id,
    percentOff: row.percent_off,
    discountCents,
  });
}
