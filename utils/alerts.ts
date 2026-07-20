import { createClient as createAdminClient } from "@supabase/supabase-js";

// Owner alerting: in-app notifications + email (Brevo API) + phone push (ntfy).
//
// Email goes through Brevo's transactional API (not SMTP) — serverless functions
// send from rotating IPs, which Brevo's SMTP/IP allowlisting blocks, so the API
// with a key is the reliable path. Phone alerts go through ntfy.sh (free,
// open-source push) instead of a paid SMS provider.
//
// Every channel is best-effort and independently guarded, wrapped in
// Promise.allSettled so a missing config / outage never blocks the user action
// or the other channels. In-app notifications need no extra config; the others
// activate once their env vars are set:
//
//   OWNER_ALERT_EMAIL                                  (default: cjblue27@gmail.com)
//   BREVO_API_KEY, BREVO_SENDER_EMAIL (default no-reply@northedm.com)  — email
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

// Email via Brevo's transactional API. From address must be a verified Brevo sender.
async function emailOwner(subject: string, text: string) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@northedm.com";
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "NorthEDM Alerts", email: senderEmail },
        to: [{ email: OWNER_EMAIL }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) console.error("owner email failed:", res.status, await res.text().catch(() => ""));
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

/**
 * Owner alert for a brand-new account — in-app + phone push + email. (Email was
 * previously omitted, which meant signups were easy to miss; growth is
 * high-signal, so it now emails too.) Call once per account (the caller dedupes).
 */
export async function notifyNewSignup(opts: { email: string; name?: string }) {
  const who = opts.name && opts.name !== opts.email ? `${opts.name} (${opts.email})` : opts.email;
  const path = "/admin/users";
  const reviewUrl = SITE_URL ? `${SITE_URL}${path}` : path;
  await Promise.allSettled([
    notifyAdminsInApp("user_signup", `New account signup: ${who}.`, path),
    pushOwner("New NorthEDM signup", who, reviewUrl),
    emailOwner(`👋 New NorthEDM signup — ${who}`, `A new account was just created: ${who}.\n\nSee all users: ${reviewUrl}`),
  ]);
}

/** Owner alert for a paid store order — all channels (it's high-signal: money). */
export async function notifyNewOrder(opts: { total_cents: number; email?: string | null; itemCount: number }) {
  const path = "/admin/shop/orders";
  const reviewUrl = SITE_URL ? `${SITE_URL}${path}` : path;
  const amount = `$${(opts.total_cents / 100).toFixed(2)}`;
  const who = opts.email ? ` from ${opts.email}` : "";
  const message = `New store order — ${amount}, ${opts.itemCount} item${opts.itemCount === 1 ? "" : "s"}${who}.`;
  await Promise.allSettled([
    notifyAdminsInApp("shop_order", message, path),
    emailOwner(`🛒 New NorthEDM order — ${amount}`, `${message}\n\nView it: ${reviewUrl}`),
    pushOwner("New NorthEDM order", `${amount} · ${opts.itemCount} item${opts.itemCount === 1 ? "" : "s"}`, reviewUrl),
  ]);
}

/** New Marketplace-access application — email + phone push + in-app. */
export async function notifyMarketplaceApplication(opts: { businessName: string; email?: string }) {
  const path = "/admin/marketplace";
  const reviewUrl = SITE_URL ? `${SITE_URL}${path}` : path;
  const who = opts.email ? ` (${opts.email})` : "";
  const message = `New Marketplace application: ${opts.businessName}${who}.`;
  await Promise.allSettled([
    notifyAdminsInApp("marketplace_application", message, path),
    emailOwner(`🏪 New Marketplace application — ${opts.businessName}`, `${message}\n\nReview it: ${reviewUrl}`),
    pushOwner("New Marketplace application", `${opts.businessName}${who}`, reviewUrl),
  ]);
}

/** User-submitted feedback (beta testing) — email + phone push + in-app. */
export async function notifyFeedback(opts: { message: string; category?: string; email?: string }) {
  const cat = opts.category?.trim() || "General";
  const from = opts.email?.trim() ? ` from ${opts.email.trim()}` : " (anonymous)";
  const message = `New ${cat} feedback${from}:\n\n${opts.message}`;
  const path = "/admin/users";
  const reviewUrl = SITE_URL ? `${SITE_URL}${path}` : path;
  await Promise.allSettled([
    notifyAdminsInApp("feedback", `New ${cat} feedback${from}.`, path),
    emailOwner(`💬 NorthEDM feedback — ${cat}`, message),
    pushOwner("New NorthEDM feedback", `${cat}${from}`, reviewUrl),
  ]);
}

