import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const tokenHash  = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const next       = searchParams.get("next") ?? "/feed";

  const supabase = await createClient();

  if (tokenHash && type) {
    // Email confirmation / magic link / password reset via token_hash
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } else if (code) {
    // OAuth / PKCE code exchange
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
