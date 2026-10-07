import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { finalizeAuthedUser } from "@/utils/finalizeSignup";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const tokenHash  = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next") ?? "/feed";

  const supabase = await createClient();

  // Same prefetch problem as /auth/confirm: a one-time token can be spent by a
  // browser or mail scanner prefetching the link, and that request shares the
  // cookie jar, so the session is already set when the second attempt fails.
  const alreadySignedIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  };

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error && !(await alreadySignedIn())) {
      console.error(`[auth/callback] verifyOtp failed type=${type}: ${error.message}`);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && !(await alreadySignedIn())) {
      console.error(`[auth/callback] code exchange failed: ${error.message}`);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    // No code and no token_hash. Historically this meant the tokens arrived in
    // the URL fragment, which no server route can read — the bug that sent
    // every auth email to /login. Links are built by authConfirmUrl() now, so
    // reaching here again means something is still handing out an old link.
    console.error(`[auth/callback] no code or token_hash on ${request.url}`);
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  // Seed profile (new users) + alert the owner, once. Shared with /auth/confirm.
  const newUserRedirect = await finalizeAuthedUser(supabase);
  return NextResponse.redirect(`${origin}${newUserRedirect ?? next}`);
}
