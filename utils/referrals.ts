import { createClient as createAdminClient } from "@supabase/supabase-js";

const REFERRAL_REWARD_CENTS = 100; // $1.00 to each side

/**
 * Grants the referral reward once a referred user's email is confirmed.
 * Credits both the referring promoter and the new user $1.00 in store credit.
 * Idempotent: the referrals UNIQUE(referred_user_id) constraint plus an
 * up-front check prevent double rewards, so this is safe to call on every
 * auth callback.
 */
export async function awardReferralReward(userId: string, rawCode?: string | null) {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Already rewarded?
  const { data: existing } = await admin
    .from("referrals")
    .select("id")
    .eq("referred_user_id", userId)
    .maybeSingle();
  if (existing) return;

  const { data: promoter } = await admin
    .from("festdash_promoters")
    .select("user_id")
    .eq("referral_code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (!promoter?.user_id || promoter.user_id === userId) return;

  const { error: refErr } = await admin.from("referrals").insert({
    referrer_id: promoter.user_id,
    referred_user_id: userId,
    code,
    reward_cents: REFERRAL_REWARD_CENTS,
  });
  if (refErr) return; // unique violation = already rewarded by a concurrent call

  await admin.rpc("grant_store_credit", {
    p_user: promoter.user_id, p_amount: REFERRAL_REWARD_CENTS,
    p_reason: "referral_bonus", p_ref_type: "referral", p_ref_id: userId,
  });
  await admin.rpc("grant_store_credit", {
    p_user: userId, p_amount: REFERRAL_REWARD_CENTS,
    p_reason: "referral_signup", p_ref_type: "referral", p_ref_id: promoter.user_id,
  });
}
