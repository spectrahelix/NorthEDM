import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type SendResult } from "@/utils/authEmail";

/**
 * Transactional email + in-app notices to people other than the owner (shops,
 * coordinators). The owner's own alerts live in utils/alerts.ts. One branded
 * shell so every message the site sends looks the same; every sender here is
 * best-effort and returns a result instead of throwing, so a mail outage never
 * fails the action that triggered it.
 */

export const BRAND = "NorthEDM";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.northedm.com").replace(/\/$/, "");

export type EmailRow = [label: string, value: string | null | undefined];

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function absUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${SITE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function brandedEmail(opts: {
  heading: string;
  intro: string;
  rows?: EmailRow[];
  cta?: { label: string; path: string };
  outro?: string;
  footer?: string;
}): { html: string; text: string } {
  const rows = (opts.rows ?? []).filter(([, v]) => v != null && String(v).trim() !== "") as [string, string][];
  const cta = opts.cta ? { label: opts.cta.label, url: absUrl(opts.cta.path) } : null;
  const footer = opts.footer ?? `You're getting this because of your account on ${BRAND}.`;

  const rowsHtml = rows.length
    ? `<tr><td style="padding-bottom:24px;"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #262626;border-radius:12px;background:#0f0f0f;">${rows
        .map(
          ([l, v]) =>
            `<tr><td style="padding:8px 12px;color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:1px;vertical-align:top;white-space:nowrap;">${escapeHtml(l)}</td><td style="padding:8px 12px;color:#e5e5e5;font-size:14px;line-height:1.5;word-break:break-word;">${escapeHtml(String(v)).replace(/\n/g, "<br>")}</td></tr>`
        )
        .join("")}</table></td></tr>`
    : "";
  const ctaHtml = cta
    ? `<tr><td style="padding-bottom:20px;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#39FF14;color:#000000;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;">${escapeHtml(cta.label)}</a></td></tr>
        <tr><td style="padding-bottom:24px;"><a href="${escapeHtml(cta.url)}" style="color:#3AFFD4;font-size:12px;word-break:break-all;">${escapeHtml(cta.url)}</a></td></tr>`
    : "";
  const outroHtml = opts.outro
    ? `<tr><td style="color:#a3a3a3;font-size:14px;line-height:1.6;padding-bottom:24px;">${escapeHtml(opts.outro).replace(/\n/g, "<br>")}</td></tr>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141414;border:1px solid #262626;border-radius:16px;padding:32px;">
        <tr><td style="color:#39FF14;font-size:13px;letter-spacing:3px;text-transform:uppercase;padding-bottom:20px;">${BRAND}</td></tr>
        <tr><td style="color:#ffffff;font-size:24px;font-weight:700;padding-bottom:12px;">${escapeHtml(opts.heading)}</td></tr>
        <tr><td style="color:#a3a3a3;font-size:15px;line-height:1.6;padding-bottom:24px;">${escapeHtml(opts.intro).replace(/\n/g, "<br>")}</td></tr>
        ${rowsHtml}
        ${ctaHtml}
        ${outroHtml}
        <tr><td style="border-top:1px solid #262626;padding-top:20px;color:#6b6b6b;font-size:12px;line-height:1.6;">${escapeHtml(footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    opts.heading,
    "",
    opts.intro,
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    rows.length ? "" : null,
    cta ? `${cta.label}: ${cta.url}` : null,
    opts.outro ? `\n${opts.outro}` : null,
    "",
    footer,
    `— ${BRAND}`,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  return { html, text };
}

/** Send one branded email. A missing address is a soft failure, not an exception. */
export async function emailUser(
  to: string | null | undefined,
  subject: string,
  parts: Parameters<typeof brandedEmail>[0]
): Promise<SendResult> {
  if (!to) return { ok: false, error: "no email address on file" };
  const { html, text } = brandedEmail(parts);
  return sendEmail({ to, subject, html, text });
}

/** One in-app notification for one person (the bell in the header). */
export async function notifyUserInApp(
  admin: SupabaseClient,
  userId: string | null | undefined,
  type: string,
  message: string,
  link: string
): Promise<void> {
  if (!userId) return;
  const { error } = await admin.from("notifications").insert({ user_id: userId, type, message, link });
  if (error) console.error("in-app notify failed:", error.message);
}

/** Account email for a user id — lives in auth.users, so service role only. */
export async function userEmailById(admin: SupabaseClient, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}
