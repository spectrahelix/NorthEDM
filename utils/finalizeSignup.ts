import type { SupabaseClient } from "@supabase/supabase-js";
import { awardReferralReward } from "@/utils/referrals";
import { notifyNewSignup } from "@/utils/alerts";

// Shared post-authentication handling, called from BOTH /auth/callback and
// /auth/confirm so a signup is never silent regardless of which URL Supabase's
// confirmation link uses. Seeds the profile for brand-new users, grants any
// referral reward, and alerts the owner exactly once (claimed atomically).
//
// Returns a path to redirect a brand-new user to (profile setup), or null to
// send them to the default `next`.
export async function finalizeAuthedUser(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Email confirmed → grant any pending referral reward (idempotent).
  await awardReferralReward(user.id, user.user_metadata?.referral_code as string | undefined);

  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("id, signup_alerted, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    // Brand-new (typically OAuth, or an unseeded confirm) — seed profiles.
    const emailPrefix = user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) ?? "user";
    const displayName = (user.user_metadata?.full_name as string | undefined)
      ?? (user.user_metadata?.name as string | undefined)
      ?? (user.user_metadata?.username as string | undefined)
      ?? emailPrefix;
    const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

    await Promise.all([
      supabase.from("user_profiles").upsert({
        id: user.id,
        display_name: displayName,
        role: "drifter",
        bio: "",
        home_city: "",
        avatar_border: "moss",
        avatar_url: avatarUrl,
        signup_alerted: true,
      }),
      supabase.from("profiles").upsert(
        { id: user.id, role: "user", username: emailPrefix },
        { onConflict: "username", ignoreDuplicates: true }
      ),
    ]);

    await notifyNewSignup({ email: user.email ?? "", name: displayName });
    return "/profile/edit?welcome=1";
  }

  // Existing profile (e.g. email/password confirming): alert once, claimed
  // atomically so repeat logins never re-alert.
  if (!existingProfile.signup_alerted) {
    const { data: claimed } = await supabase
      .from("user_profiles")
      .update({ signup_alerted: true })
      .eq("id", user.id)
      .eq("signup_alerted", false)
      .select("id")
      .maybeSingle();
    if (claimed) {
      await notifyNewSignup({
        email: user.email ?? "",
        name: (existingProfile.display_name as string | undefined) || undefined,
      });
    }
  }
  return null;
}
