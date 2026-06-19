import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 7; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function vendorIdFor(userId: string): Promise<number | null> {
  const a = admin();
  const { data } = await a.from("profiles").select("vendor_id").eq("id", userId).maybeSingle();
  return data?.vendor_id ?? null;
}

// Create a commission code for the current vendor's products. Customers get
// `percentOff` off the vendor's items; the same amount is booked as commission
// to NorthEDM (the vendor absorbs both).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendorId = await vendorIdFor(user.id);
  if (!vendorId) {
    return NextResponse.json({ error: "Only vendors can create commission codes." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const percentOff = Math.round(Number(body.percentOff));
  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
    return NextResponse.json({ error: "Percent off must be between 1 and 100." }, { status: 400 });
  }
  const maxRedemptions =
    body.maxRedemptions === null || body.maxRedemptions === undefined || body.maxRedemptions === ""
      ? null
      : Math.max(1, Math.round(Number(body.maxRedemptions)));

  const a = admin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { data, error } = await a
      .from("festdash_promo_codes")
      .insert({
        code,
        kind: "vendor",
        beneficiary: "platform",
        vendor_id: vendorId,
        percent_off: percentOff,
        commission_bps: 0,
        max_redemptions: maxRedemptions,
        owner_id: user.id,
        active: true,
      })
      .select()
      .single();
    if (!error && data) return NextResponse.json({ code: data });
  }
  return NextResponse.json({ error: "Couldn't generate a code. Try again." }, { status: 500 });
}

// List the current vendor's commission codes.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendorId = await vendorIdFor(user.id);
  if (!vendorId) return NextResponse.json({ codes: [] });

  const { data } = await admin()
    .from("festdash_promo_codes")
    .select("id, code, percent_off, max_redemptions, times_redeemed, active, created_at")
    .eq("vendor_id", vendorId)
    .eq("kind", "vendor")
    .order("created_at", { ascending: false });

  return NextResponse.json({ codes: data ?? [] });
}
