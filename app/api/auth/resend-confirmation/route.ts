import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { sendAuthEmail, authEmailConfigured } from "@/utils/authEmail";

// Resend the signup confirmation. Same reasoning as signup and password reset:
// supabase.auth.resend() hands the send to Supabase's SMTP, which is the path
// that fails here, so we mint the link ourselves and deliver it over Brevo's
// HTTP API instead.

export async function POST(req: NextRequest) {
  const { email, origin } = (await req.json().catch(() => ({}))) as {
    email?: string;
    origin?: string;
  };
  if (!email || !origin) {
    return NextResponse.json({ error: "Missing email or origin." }, { status: 400 });
  }

  const address = String(email).trim().toLowerCase();
  const redirectTo = `${origin}/auth/callback`;

  if (!authEmailConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // magiclink, not signup: generateLink("signup") requires the password, which
  // we don't have on a resend. For an account that hasn't confirmed yet,
  // verifying a magic link confirms the address and signs them in — the same
  // outcome the confirmation link produces, without needing the credential.
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: address,
    options: { redirectTo },
  });

  if (error || !link?.properties?.action_link) {
    // Already confirmed is a success from the user's point of view: there is
    // nothing left for them to do, and saying so beats a scary error.
    if (error && /already|confirmed/i.test(error.message)) {
      return NextResponse.json({
        success: true,
        note: "That address is already confirmed — you can sign in.",
      });
    }
    console.error("resend link error:", error?.message);
    return NextResponse.json(
      { error: "We couldn't resend that. Use “Trouble signing in?” and we'll help directly." },
      { status: 400 }
    );
  }

  const sent = await sendAuthEmail(address, "signup", link.properties.action_link);
  if (!sent.ok) {
    return NextResponse.json(
      { error: "We couldn't send that email. Use “Trouble signing in?” and we'll help directly." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
