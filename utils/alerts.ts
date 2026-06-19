import { createClient as createAdminClient } from "@supabase/supabase-js";

// Owner alerting: in-app notifications + email (Resend) + SMS (Twilio).
//
// Every channel is best-effort and independently guarded by its env vars, so a
// missing key or a provider outage never blocks the user action that triggered
// it, and one channel failing doesn't stop the others. In-app notifications
// work with no extra config; email/SMS activate once their env vars are set:
//
//   OWNER_ALERT_EMAIL   (default: cjblue27@gmail.com)
//   OWNER_ALERT_PHONE   (E.164, e.g. +15555551234)  — required for SMS
//   RESEND_API_KEY, RESEND_FROM                      — email
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM — SMS
//   NEXT_PUBLIC_SITE_URL                             — absolute links in alerts

const OWNER_EMAIL = process.env.OWNER_ALERT_EMAIL || "cjblue27@gmail.com";
const OWNER_PHONE = process.env.OWNER_ALERT_PHONE || "";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function emailOwner(subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.RESEND_FROM || "NorthEDM Alerts <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [OWNER_EMAIL], subject, text }),
    });
    if (!res.ok) console.error("owner email failed:", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("owner email error:", e);
  }
}

async function smsOwner(body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from || !OWNER_PHONE) return;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: OWNER_PHONE, From: from, Body: body }),
    });
    if (!res.ok) console.error("owner sms failed:", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("owner sms error:", e);
  }
}

// In-app notifications for every admin (archon/warden).
async function notifyAdminsInApp(type: string, message: string, link: string) {
  try {
    const a = admin();
    const { data: admins } = await a
      .from("user_profiles").select("id").in("role", ["archon", "warden"]);
    const rows = (admins ?? []).map((r) => ({ user_id: r.id, type, message, link }));
    if (rows.length) await a.from("notifications").insert(rows);
  } catch (e) {
    console.error("admin in-app notify error:", e);
  }
}

/** Fan out an alert to the owner across every configured channel. */
export async function notifyNewApplication(opts: {
  kind: "vendor" | "promoter";
  name: string;
  email: string;
  detail?: string;
}) {
  const label = opts.kind === "vendor" ? "FestDash vendor" : "FestDash promoter";
  const path = opts.kind === "vendor" ? "/admin/festdash" : "/admin/festdash/promoters";
  const reviewUrl = SITE_URL ? `${SITE_URL}${path}` : path;

  const message = `New ${label} application from ${opts.name} (${opts.email}).`;
  const subject = `🎪 New ${label} application — ${opts.name}`;
  const emailText =
    `${message}\n${opts.detail ? `\n${opts.detail}\n` : ""}\nReview it here: ${reviewUrl}`;
  const smsText = `NorthEDM: new ${label} application from ${opts.name}. Review: ${reviewUrl}`;

  await Promise.allSettled([
    notifyAdminsInApp(`festdash_${opts.kind}_application`, message, path),
    emailOwner(subject, emailText),
    smsOwner(smsText),
  ]);
}
