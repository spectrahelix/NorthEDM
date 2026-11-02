import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Promoter records. A promoter is more than a badge: they need a row in
 * festdash_promoters (payout method, active flag) and a referral code to hand
 * out. Approving a promoter application and granting the Promoter tag from
 * /admin/users both go through here, so neither can leave a half-made promoter.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function makeReferralCode(): string {
  let out = "";
  for (let i = 0; i < 7; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** Mint a referral code for a promoter row that has none. Idempotent. */
export async function ensureReferralCode(admin: SupabaseClient, promoterUserId: string): Promise<string | null> {
  const { data: row } = await admin
    .from("festdash_promoters")
    .select("id, referral_code")
    .eq("user_id", promoterUserId)
    .maybeSingle();
  if (!row) return null;
  if (row.referral_code) return row.referral_code as string;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeReferralCode();
    const { error } = await admin.from("festdash_promoters").update({ referral_code: code }).eq("id", row.id);
    if (!error) return code; // a unique violation retries with a new code
  }
  return null;
}

/** Make someone a promoter: active row, referral code, profile tag. */
export async function grantPromoter(admin: SupabaseClient, userId: string): Promise<{ referral_code: string | null }> {
  const { data: prof } = await admin.from("user_profiles").select("display_name").eq("id", userId).maybeSingle();
  await admin
    .from("festdash_promoters")
    .upsert({ user_id: userId, display_name: prof?.display_name ?? "", is_active: true }, { onConflict: "user_id" });
  const referral_code = await ensureReferralCode(admin, userId);
  await admin.from("user_profiles").update({ is_promoter: true }).eq("id", userId);
  return { referral_code };
}

/** Take the tag away and pause the promoter row. The code and history stay. */
export async function revokePromoter(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.from("festdash_promoters").update({ is_active: false }).eq("user_id", userId);
  await admin.from("user_profiles").update({ is_promoter: false }).eq("id", userId);
}
