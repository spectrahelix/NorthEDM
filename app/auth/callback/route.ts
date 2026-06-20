import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { awardReferralReward } from "@/utils/referrals";
import { notifyNewSignup } from "@/utils/alerts";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const tokenHash  = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next") ?? "/feed";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  // Check if this is a new OAuth user who has no profile yet
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Email is now confirmed — grant any pending referral reward (idempotent).
    await awardReferralReward(
      user.id,
      user.user_metadata?.referral_code as string | undefined
    );

    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id, signup_alerted, display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      // New OAuth signup — seed profiles and send them to profile setup
      const emailPrefix = user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) ?? "user";
      const displayName = (user.user_metadata?.full_name as string | undefined)
        ?? (user.user_metadata?.name as string | undefined)
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
        // profiles.username must be unique — use email prefix, ignore conflict
        supabase.from("profiles").upsert(
          { id: user.id, role: "user", username: emailPrefix },
          { onConflict: "username", ignoreDuplicates: true }
        ),
      ]);

      // Owner alert for the new account (in-app + push, once).
      await notifyNewSignup({ email: user.email ?? "", name: displayName });

      return NextResponse.redirect(`${origin}/profile/edit`);
    }

    // Existing profile (e.g. an email/password account confirming): alert the
    // owner once, claimed atomically so repeat logins never re-alert.
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
  }

  return NextResponse.redirect(`${origin}${next}`);
}
