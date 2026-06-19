import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Mints a fresh single-use referral code for the current vendor or promoter.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Determine issuer kind: vendor (has vendor_id) or active promoter.
  const [{ data: profile }, { data: promoter }] = await Promise.all([
    supabase.from("profiles").select("vendor_id").eq("id", user.id).maybeSingle(),
    supabase.from("festdash_promoters").select("id, is_active").eq("user_id", user.id).maybeSingle(),
  ]);

  let issuerKind: "vendor" | "promoter" | null = null;
  if (profile?.vendor_id) issuerKind = "vendor";
  else if (promoter?.is_active) issuerKind = "promoter";

  if (!issuerKind) {
    return NextResponse.json(
      { error: "Only vendors and approved promoters can generate referral codes." },
      { status: 403 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { data, error } = await admin
      .from("referral_codes")
      .insert({ code, issuer_id: user.id, issuer_kind: issuerKind })
      .select()
      .single();
    if (!error && data) return NextResponse.json({ code: data });
  }

  return NextResponse.json({ error: "Couldn't generate a code. Try again." }, { status: 500 });
}
