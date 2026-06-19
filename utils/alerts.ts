import { createClient as createAdminClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// Owner alerting: in-app notifications + email (your own SMTP) + phone push (ntfy).
//
// No third-party email SaaS (no Resend). Email goes through any SMTP mailbox you
// already control — the same kind of credentials Supabase's Custom SMTP uses.
// Phone alerts go through ntfy.sh (free, open-source push; install the ntfy app
// and subscribe to your topic) instead of a paid SMS provider.
//
// Every channel is best-effort and independently guarded, wrapped in
// Promise.allSettled so a missing config / outage never blocks the user action
// or the other channels. In-app notifications need no extra config; the others
// activate once their env vars are set:
//
//   OWNER_ALERT_EMAIL                                  (default: cjblue27@gmail.com)
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM   — email
//   NTFY_TOPIC, NTFY_SERVER (default https://ntfy.sh)  — phone push ("text")
//   NEXT_PUBLIC_SITE_URL                               — absolute links in alerts

const OWNER_EMAIL = process.env.OWNER_ALERT_EMAIL || "cjblue27@gmail.com";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Email via your own SMTP mailbox (nodemailer). No SaaS provider.
async function emailOwner(subject: string, text: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return;
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM || user;
  try {
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
    });
    await transport.sendMail({ from, to: OWNER_EMAIL, subject, text });
  } catch (e) {
    console.error("owner email error:", e);
  }
}

// Phone push via ntfy.sh (free, no account). Arrives on your phone like a text.
async function pushOwner(title: string, message: string, clickUrl?: string) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  const server = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
  try {
    const res = await fetch(`${server}/${topic}`, {
      method: "POST",
      headers: {
        Title: title,
        Tags: "tada",
        ...(clickUrl ? { Click: clickUrl } : {}),
      },
      body: message,
    });
    if (!res.ok) console.error("owner push failed:", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("owner push error:", e);
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

  await Promise.allSettled([
    notifyAdminsInApp(`festdash_${opts.kind}_application`, message, path),
    emailOwner(subject, emailText),
    pushOwner(`New ${label} application`, `${opts.name} (${opts.email})`, reviewUrl),
  ]);
}
