/**
 * Auth emails — confirmation, password reset, email change.
 *
 * WHY THIS FILE EXISTS. Supabase Auth sends these itself over SMTP, and that
 * path is broken here: the configured provider rejects Supabase's sending IPs
 * with 525 "5.7.1 Unauthorized IP address". Supabase does not create the account
 * when the mail fails, so every signup returned an error and wrote nothing, and
 * every password reset 500'd. Total auth outage, invisible from the outside,
 * for two months.
 *
 * utils/alerts.ts had already hit and solved exactly this for owner alerts:
 *
 *   "serverless functions send from rotating IPs, which Brevo's SMTP/IP
 *    allowlisting blocks, so the API with a key is the reliable path"
 *
 * That lesson just never reached the auth emails, because Supabase sends those
 * itself. So we take them over: mint the link with the admin API
 * (generateLink does NOT send anything) and deliver it over the same Brevo HTTP
 * API that demonstrably works from this runtime.
 *
 * The upshot is that auth no longer depends on SMTP being configured correctly
 * in two places. If BREVO_API_KEY is absent we fall back to letting Supabase
 * send, so a fresh environment still behaves sanely.
 */

const BRAND = "NorthEDM";

export type AuthEmailKind = "signup" | "recovery" | "email_change";

type Copy = { subject: string; heading: string; body: string; cta: string; footer: string };

const COPY: Record<AuthEmailKind, Copy> = {
  signup: {
    subject: `Confirm your ${BRAND} account`,
    heading: "Confirm your email",
    body: "You're one click from joining the Northeast's EDM and festival community. Confirm your email to activate your account.",
    cta: "Confirm my email",
    footer: "If you didn't sign up for NorthEDM, you can ignore this email — no account will be created.",
  },
  recovery: {
    subject: `Reset your ${BRAND} password`,
    heading: "Reset your password",
    body: "We got a request to reset your password. Click below to choose a new one. This link expires in an hour.",
    cta: "Choose a new password",
    footer: "If you didn't ask to reset your password, you can ignore this email — your password stays as it is.",
  },
  email_change: {
    subject: `Confirm your new ${BRAND} email`,
    heading: "Confirm your new email",
    body: "Confirm this address to finish moving your NorthEDM account to it.",
    cta: "Confirm this address",
    footer: "If you didn't request this change, ignore this email and your address stays as it is.",
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render(kind: AuthEmailKind, link: string): { html: string; text: string } {
  const c = COPY[kind];
  const safeLink = escapeHtml(link);
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border:1px solid #262626;border-radius:16px;padding:32px;">
        <tr><td style="color:#39FF14;font-size:13px;letter-spacing:3px;text-transform:uppercase;padding-bottom:20px;">${BRAND}</td></tr>
        <tr><td style="color:#ffffff;font-size:26px;font-weight:700;padding-bottom:12px;">${c.heading}</td></tr>
        <tr><td style="color:#a3a3a3;font-size:15px;line-height:1.6;padding-bottom:28px;">${c.body}</td></tr>
        <tr><td style="padding-bottom:28px;">
          <a href="${safeLink}" style="display:inline-block;background:#39FF14;color:#000000;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;">${c.cta}</a>
        </td></tr>
        <tr><td style="color:#6b6b6b;font-size:12px;line-height:1.6;padding-bottom:8px;">Button not working? Paste this into your browser:</td></tr>
        <tr><td style="padding-bottom:24px;"><a href="${safeLink}" style="color:#3AFFD4;font-size:12px;word-break:break-all;">${safeLink}</a></td></tr>
        <tr><td style="border-top:1px solid #262626;padding-top:20px;color:#6b6b6b;font-size:12px;line-height:1.6;">${c.footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `${c.heading}\n\n${c.body}\n\n${link}\n\n${c.footer}\n\n— ${BRAND}`;
  return { html, text };
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** True when we can deliver auth mail ourselves rather than relying on SMTP. */
export function authEmailConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

export async function sendAuthEmail(
  to: string,
  kind: AuthEmailKind,
  actionLink: string
): Promise<SendResult> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, error: "No email provider configured (BREVO_API_KEY)." };

  const sender = process.env.BREVO_SENDER_EMAIL || "no-reply@northedm.com";
  const c = COPY[kind];
  const { html, text } = render(kind, actionLink);

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: BRAND, email: sender },
        to: [{ email: to }],
        subject: c.subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("auth email send failed:", res.status, detail);
      return { ok: false, error: `Email provider rejected the message (${res.status}).` };
    }
    return { ok: true };
  } catch (e) {
    console.error("auth email send error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}
