import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function makeReferralCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let out = "";
  for (let i = 0; i < 7; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Ensures the current (approved) promoter has a referral code, minting one
// if needed. Safety net for promoters approved before codes existed.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: promoter } = await admin
    .from("festdash_promoters")
    .select("id, referral_code, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!promoter || !promoter.is_active) {
    return NextResponse.json({ error: "Not an active promoter." }, { status: 403 });
  }
  if (promoter.referral_code) {
    return NextResponse.json({ referralCode: promoter.referral_code });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeReferralCode();
    const { error } = await admin
      .from("festdash_promoters")
      .update({ referral_code: code })
      .eq("id", promoter.id);
    if (!error) return NextResponse.json({ referralCode: code });
  }

  return NextResponse.json({ error: "Could not generate a code. Try again." }, { status: 500 });
}
