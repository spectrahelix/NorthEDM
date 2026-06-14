import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function confirmationEmail(confirmUrl: string, email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Confirm your NorthEDM account</title></head>
<body style="margin:0;padding:0;background:#030303;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030303;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td align="center" style="padding-bottom:32px;">
          <p style="margin:0;font-size:26px;font-weight:900;letter-spacing:0.15em;color:#39FF14;text-transform:uppercase;">NorthEDM</p>
          <p style="margin:4px 0 0;font-size:10px;letter-spacing:0.3em;color:rgba(57,255,20,0.4);text-transform:uppercase;">Unite the Northeast</p>
        </td></tr>
        <tr><td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px 36px;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.3em;color:#3AFFD4;text-transform:uppercase;">Account Confirmation</p>
          <h1 style="margin:0 0 16px;font-size:28px;font-weight:900;color:#f5f5f5;">You're almost in.</h1>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#a3a3a3;">Here's your new confirmation link. Click below to activate your NorthEDM account. This link expires in 24 hours.</p>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="${confirmUrl}" style="display:inline-block;background:#39FF14;color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 36px;">
              Confirm My Account →
            </a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:12px;color:#525252;line-height:1.6;">
            Or paste this URL in your browser:<br />
            <a href="${confirmUrl}" style="color:#3AFFD4;word-break:break-all;">${confirmUrl}</a>
          </p>
          <hr style="margin:28px 0;border:none;border-top:1px solid rgba(255,255,255,0.07);" />
          <p style="margin:0;font-size:12px;color:#404040;">If you didn't request this, ignore it. No action needed.</p>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#404040;">© ${new Date().getFullYear()} NorthEDM</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const { email, origin } = await req.json() as { email: string; origin: string };
  if (!email || !origin) {
    return NextResponse.json({ error: "Missing email or origin." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  const confirmUrl = linkData.properties?.action_link;
  if (!confirmUrl) {
    return NextResponse.json({ error: "Could not generate link." }, { status: 500 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend-confirmation] RESEND_API_KEY not set — confirm URL:", confirmUrl);
    return NextResponse.json({ success: true, _devConfirmUrl: confirmUrl });
  }

  const resend = new Resend(apiKey);
  const { error: emailError } = await resend.emails.send({
    from: "NorthEDM <no-reply@northedm.com>",
    to: email,
    subject: "Your NorthEDM confirmation link",
    html: confirmationEmail(confirmUrl, email),
  });

  if (emailError) {
    return NextResponse.json({ error: emailError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
