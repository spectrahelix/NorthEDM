import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cjblue27@gmail.com";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Ranks we won't downgrade when elevating someone to promoter.
const SENIOR_ROLES = ["archon", "warden", "merchant"];

// Short, unguessable, human-friendly referral code.
function makeReferralCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let out = "";
  for (let i = 0; i < 7; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function ensureReferralCode(
  adminClient: ReturnType<typeof getAdminClient>,
  promoterUserId: string
) {
  const { data: row } = await adminClient
    .from("festdash_promoters")
    .select("id, referral_code")
    .eq("user_id", promoterUserId)
    .single();
  if (!row || row.referral_code) return;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeReferralCode();
    const { error } = await adminClient
      .from("festdash_promoters")
      .update({ referral_code: code })
      .eq("id", row.id);
    if (!error) return; // unique violation → retry with a new code
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin =
    me?.role === "archon" || me?.role === "warden" || user.email === ADMIN_EMAIL;
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = getAdminClient();
  const { id } = await params;
  const { action } = await req.json(); // "approve" | "reject"

  if (action === "approve") {
    const { data: app } = await adminClient
      .from("festdash_promoter_applications")
      .select("user_id, display_name")
      .eq("id", id)
      .single();

    if (app?.user_id) {
      // Create / activate the promoter record
      await adminClient.from("festdash_promoters").upsert({
        user_id: app.user_id,
        display_name: app.display_name ?? "",
        is_active: true,
      }, { onConflict: "user_id" });

      // Mint their referral code (idempotent — skips if already set)
      await ensureReferralCode(adminClient, app.user_id);

      // Elevate rank to 'promoter' unless they already hold a senior role
      const { data: prof } = await adminClient
        .from("user_profiles").select("role").eq("id", app.user_id).single();
      if (!prof || !SENIOR_ROLES.includes(prof.role)) {
        await adminClient
          .from("user_profiles")
          .update({ role: "promoter" })
          .eq("id", app.user_id);
      }

      // Light up the Promoter tag on their profile.
      await adminClient
        .from("user_profiles")
        .update({ is_promoter: true })
        .eq("id", app.user_id);
    }
  }

  const { error } = await adminClient
    .from("festdash_promoter_applications")
    .update({ status: action === "approve" ? "approved" : "rejected" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
