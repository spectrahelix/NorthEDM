import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Supabase sends email confirmation links to /auth/confirm in some configurations
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
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
