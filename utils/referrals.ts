import { createClient as createAdminClient } from "@supabase/supabase-js";

const REFERRAL_REWARD_CENTS = 100; // $1.00 to each side

/**
 * Redeems a one-time referral code once the referred user's email is confirmed,
 * crediting both the code's issuer and the new user $1.00 in store credit.
 *
 * Idempotent and safe to call on every auth callback:
 *  - claim_referral_code() atomically flips the code to redeemed (and refuses
 *    self-redemption / already-used codes),
 *  - the referrals UNIQUE(referred_user_id) guards against a user being
 *    rewarded twice across different codes.
 */
export async function awardReferralReward(userId: string, rawCode?: string | null) {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // This user already earned a referral reward?
  const { data: already } = await admin
    .from("referrals")
    .select("id")
    .eq("referred_user_id", userId)
    .maybeSingle();
  if (already) return;

  // Atomically claim the one-time code.
  const { data: claimed } = await admin.rpc("claim_referral_code", {
    p_code: code,
    p_redeemer: userId,
  });
  if (!claimed) return; // unknown, already used, or self-issued

  const issuerId: string = claimed.issuer_id;
  const reward: number = claimed.reward_cents ?? REFERRAL_REWARD_CENTS;

  // Record the attribution (also the per-user uniqueness guard).
  const { error: refErr } = await admin.from("referrals").insert({
    referrer_id: issuerId,
    referred_user_id: userId,
    code,
    reward_cents: reward,
  });
  if (refErr) return; // lost a race — another callback already rewarded this user

  await admin.rpc("grant_store_credit", {
    p_user: issuerId, p_amount: reward,
    p_reason: "referral_bonus", p_ref_type: "referral", p_ref_id: userId,
  });
  await admin.rpc("grant_store_credit", {
    p_user: userId, p_amount: reward,
    p_reason: "referral_signup", p_ref_type: "referral", p_ref_id: issuerId,
  });
}
