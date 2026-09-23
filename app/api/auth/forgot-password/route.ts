import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { sendAuthEmail, authEmailConfigured, authConfirmUrl } from "@/utils/authEmail";

// Password reset. Server-side on purpose: supabase.auth.resetPasswordForEmail()
// from the browser asks Supabase to send over SMTP, which is the broken path —
// it returned 500 "Error sending recovery email" for every account, so anyone
// who forgot a password was locked out permanently with no way back.
//
// Here we mint the recovery link with the admin API (which sends nothing) and
// deliver it over the Brevo HTTP API that works from this runtime.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, origin } = (await req.json().catch(() => ({}))) as {
    email?: string;
    origin?: string;
  };

  if (!email || !origin) {
    return NextResponse.json({ error: "Please enter your email address." }, { status: 400 });
  }

  const address = String(email).trim().toLowerCase();
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  // Always answer the same way. Whether an address has an account is not
  // something an unauthenticated caller gets to probe.
  const genericOk = NextResponse.json({ success: true });

  if (!authEmailConfigured()) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(address, { redirectTo });
    return genericOk;
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: address,
    options: { redirectTo },
  });

  // No such user is the common case for a typo'd address — stay silent about it.
  if (error || !link?.properties?.hashed_token) {
    if (error && !/not found|no user|does not exist/i.test(error.message)) {
      console.error("recovery link error:", error.message);
    }
    return genericOk;
  }

  // Our own /auth/confirm URL, not properties.action_link — see authConfirmUrl.
  // action_link returns the tokens in the URL fragment, which no server route
  // can read, so the reset link landed on /login instead of the reset form.
  const sent = await sendAuthEmail(
    address,
    "recovery",
    authConfirmUrl({
      origin: String(origin).replace(/\/$/, ""),
      tokenHash: link.properties.hashed_token,
      type: "recovery",
      next: "/reset-password",
    })
  );
  if (!sent.ok) console.error("recovery email failed:", sent.error);

  return genericOk;
}
