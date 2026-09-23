import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { finalizeAuthedUser } from "@/utils/finalizeSignup";

// Supabase sends email confirmation links to /auth/confirm in some configurations.
// This runs the SAME post-signup handling as /auth/callback so those signups are
// never silent (seed profile + alert the owner).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type") as EmailOtpType | null;
  const next      = searchParams.get("next") ?? "/feed";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    // A one-time token can be spent before the person ever taps it. Mobile
    // browsers and mail scanners prefetch links, and on 2026-09-23 this route
    // was hit twice two seconds apart for a single recovery email: the first
    // request consumed the token, the second failed, and the person was sent
    // to /login having done nothing wrong.
    //
    // That prefetch shares the browser's cookie jar, so the session is already
    // set and only the re-verification fails. Check for it before turning
    // anyone away — this only proceeds on a real authenticated session.
    const { data: { user: already } } = await supabase.auth.getUser();
    if (already) {
      const seeded = await finalizeAuthedUser(supabase);
      return NextResponse.redirect(`${origin}${seeded ?? next}`);
    }
    // Genuinely spent (an external scanner has its own cookie jar) or invalid.
    // Log it: the redirect only carries the message in a query string, which no
    // server-side log records, so a failure here was previously undiagnosable.
    console.error(`[auth/confirm] verifyOtp failed type=${type}: ${error.message}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const newUserRedirect = await finalizeAuthedUser(supabase);
  return NextResponse.redirect(`${origin}${newUserRedirect ?? next}`);
}
