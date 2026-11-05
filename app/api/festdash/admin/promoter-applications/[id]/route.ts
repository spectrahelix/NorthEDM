import { NextResponse } from "next/server";
import { setMemberTag } from "@/utils/memberTags";
import { ensureReferralCode } from "@/utils/promoters";
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

// Short, unguessable, human-friendly referral code.

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
      .select("user_id, display_name, invited_by")
      .eq("id", id)
      .single();

    if (app?.user_id) {
      // Create / activate the promoter record
      await adminClient.from("festdash_promoters").upsert({
        user_id: app.user_id,
        display_name: app.display_name ?? "",
        is_active: true,
        ...(app.invited_by ? { invited_by: app.invited_by } : {}),
      }, { onConflict: "user_id" });

      // Mint their referral code (idempotent — skips if already set)
      await ensureReferralCode(adminClient, app.user_id);

      // Promoter is a tag, not a rank (2026-11-05): their rank stays as it is.
      await setMemberTag(adminClient, app.user_id, "promoter", true);
    }
  }

  const { error } = await adminClient
    .from("festdash_promoter_applications")
    .update({ status: action === "approve" ? "approved" : "rejected" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
