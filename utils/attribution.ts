import { createClient as createAdminClient } from "@supabase/supabase-js";

// Promoter attribution: links a new user to the promoter whose permanent,
// reusable code they arrived with, so later PAID actions can pay that promoter a
// commission (see docs/WALLET.md). No money moves here — this only records who
// referred whom.
//
// The promoter's permanent code is `festdash_promoters.referral_code` (minted on
// approval). Attribution is FIRST-TOUCH and immutable: the row is keyed by
// referred_user_id, so a later code can never steal an existing attribution.
// Self-referral is impossible (DB CHECK + the guard below).
export async function recordPromoterAttribution(userId: string, rawCode?: string | null) {
  const code = rawCode?.trim().toUpperCase();
  if (!code || !userId) return;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Does this code belong to an active promoter?
    const { data: promoter } = await admin
      .from("festdash_promoters")
      .select("user_id, is_active")
      .eq("referral_code", code)
      .maybeSingle();
    if (!promoter?.user_id || !promoter.is_active) return;
    if (promoter.user_id === userId) return; // never self-refer

    // First-touch: ignore if this user is already attributed. The primary key on
    // referred_user_id makes this safe under races too.
    await admin
      .from("referral_attributions")
      .insert({ referred_user_id: userId, promoter_user_id: promoter.user_id, code })
      .select("referred_user_id")
      .maybeSingle();
  } catch (e) {
    // Attribution must never block a signup.
    console.error("promoter attribution error:", e);
  }
}
