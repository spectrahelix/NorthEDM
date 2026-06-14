import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;

function confirmationEmail(confirmUrl: string, email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your NorthEDM account</title>
</head>
<body style="margin:0;padding:0;background:#030303;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030303;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <p style="margin:0;font-size:26px;font-weight:900;letter-spacing:0.15em;color:#39FF14;text-transform:uppercase;">NorthEDM</p>
              <p style="margin:4px 0 0;font-size:10px;letter-spacing:0.3em;color:rgba(57,255,20,0.4);text-transform:uppercase;">Unite the Northeast</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.3em;color:#3AFFD4;text-transform:uppercase;">Account Confirmation</p>
              <h1 style="margin:0 0 16px;font-size:28px;font-weight:900;color:#f5f5f5;letter-spacing:0.04em;">You're almost in.</h1>
              <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#a3a3a3;">
                Click the button below to confirm your email address and activate your NorthEDM account.
                This link expires in 24 hours.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}"
                       style="display:inline-block;background:#39FF14;color:#000000;font-size:14px;font-weight:700;letter-spacing:0.04em;text-decoration:none;border-radius:12px;padding:14px 36px;">
                      Confirm My Account →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-size:12px;color:#525252;line-height:1.6;">
                Or copy and paste this URL into your browser:<br />
                <a href="${confirmUrl}" style="color:#3AFFD4;word-break:break-all;">${confirmUrl}</a>
              </p>

              <hr style="margin:28px 0;border:none;border-top:1px solid rgba(255,255,255,0.07);" />

              <p style="margin:0;font-size:12px;color:#404040;">
                If you didn't create a NorthEDM account with <strong style="color:#737373;">${email}</strong>, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#404040;">
                © ${new Date().getFullYear()} NorthEDM · Appalachian Festival Culture
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const { email, password, username, origin } = await req.json() as {
    email: string;
    password: string;
    username: string;
    origin: string;
  };

  if (!email || !password || !username || !origin) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "Invalid username." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check username availability
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That username is taken. Try another." }, { status: 409 });
  }

  // Create user + get confirmation link in one admin call
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  const confirmUrl = linkData.properties?.action_link;
  if (!confirmUrl) {
    return NextResponse.json({ error: "Could not generate confirmation link." }, { status: 500 });
  }

  const userId = linkData.user?.id;
  if (userId) {
    await Promise.all([
      admin.from("profiles").upsert({ id: userId, role: "user", username }),
      admin.from("user_profiles").upsert({
        id: userId,
        display_name: username,
        role: "drifter",
        bio: "",
        home_city: "",
        avatar_border: "moss",
        avatar_url: null,
      }),
    ]);
  }

  // Send via Resend if configured, otherwise surface the link for debugging
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev fallback: return the link so the developer can test manually
    console.warn("[signup] RESEND_API_KEY not set — confirm URL:", confirmUrl);
    return NextResponse.json({ success: true, _devConfirmUrl: confirmUrl });
  }

  const resend = new Resend(apiKey);
  const { error: emailError } = await resend.emails.send({
    from: "NorthEDM <no-reply@northedm.com>",
    to: email,
    subject: "Confirm your NorthEDM account",
    html: confirmationEmail(confirmUrl, email),
  });

  if (emailError) {
    return NextResponse.json({ error: `Email failed: ${emailError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
