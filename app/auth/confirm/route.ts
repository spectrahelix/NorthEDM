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
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const newUserRedirect = await finalizeAuthedUser(supabase);
  return NextResponse.redirect(`${origin}${newUserRedirect ?? next}`);
}
