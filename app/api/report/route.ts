import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notifyFeedback } from "@/utils/alerts";
import { validateField } from "@/utils/reportQuality";

// "Report a problem": stores a user's bug report (screenshot + auto-captured
// page/browser/error context) and alerts the owner. Anyone can report. If a
// GitHub issues token is configured, it also opens a ready-to-fix issue.
//
// Every required field is validated HERE, not just in the form — the client can be
// bypassed, and low-effort junk was the main complaint. Rejections come back as a
// 400 with a specific message so a genuine reporter can fix and resubmit.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const title = String(form.get("title") || "").trim().slice(0, 200);
  const pageManual = String(form.get("pageManual") || "").trim().slice(0, 300);
  const description = String(form.get("description") || "").trim().slice(0, 4000);
  const doingWhat = String(form.get("doingWhat") || "").trim().slice(0, 2000);
  const reporterName = String(form.get("reporterName") || "").trim().slice(0, 120);
  const contactConsent = String(form.get("contactConsent") || "") === "true";
  const contactEmail = String(form.get("contactEmail") || "").trim().slice(0, 160);
  const contactPhone = String(form.get("contactPhone") || "").trim().slice(0, 40);
  const contactDm = String(form.get("contactDm") || "") === "true";
  const pageUrl = String(form.get("pageUrl") || "").slice(0, 500);
  const userAgent = String(form.get("userAgent") || "").slice(0, 400);
  const viewport = String(form.get("viewport") || "").slice(0, 40);
  const email = contactEmail || user?.email || null;
  let consoleErrors: unknown = [];
  try { consoleErrors = JSON.parse(String(form.get("consoleErrors") || "[]")); } catch { /* ignore */ }

  // Required fields + garbage screening. Thresholds are deliberately lenient:
  // a short-but-real report ("photos wont upload") passes; keyboard mash doesn't.
  const problem =
    validateField(title, "Title", { min: 5, minWords: 1 }) ??
    validateField(pageManual, "Page where it happened", { min: 2, minWords: 1 }) ??
    validateField(description, "What went wrong", { min: 15, minWords: 2 }) ??
    validateField(doingWhat, "What you were doing", { min: 10, minWords: 2 });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // Consent means we must actually be able to reach them.
  if (contactConsent && !contactEmail && !contactPhone && !contactDm) {
    return NextResponse.json(
      { error: "You agreed to be contacted — please add an email, a phone number, or allow a NorthEDM message." },
      { status: 400 }
    );
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }
  if (contactDm && !user) {
    return NextResponse.json(
      { error: "NorthEDM messages need an account — please sign in, or leave an email or phone instead." },
      { status: 400 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Screenshot upload (optional).
  let screenshotUrl: string | null = null;
  const file = form.get("file") as File | null;
  if (file && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Screenshot must be under 10MB." }, { status: 400 });
    }
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${(user?.id ?? "anon")}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("reports")
      .upload(path, buf, { contentType: file.type || "image/png", upsert: false });
    if (!upErr) {
      screenshotUrl = admin.storage.from("reports").getPublicUrl(path).data.publicUrl;
    }
  }

  const { data: report, error } = await admin
    .from("error_reports")
    .insert({
      user_id: user?.id ?? null,
      email,
      title,
      page_manual: pageManual,
      description,
      doing_what: doingWhat,
      reporter_name: reporterName || null,
      contact_consent: contactConsent,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      contact_dm: contactDm,
      source: "report",
      screenshot_url: screenshotUrl,
      page_url: pageUrl,
      user_agent: userAgent,
      viewport,
      console_errors: consoleErrors,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optional: open a ready-to-fix GitHub issue (env-gated).
  let githubIssueUrl: string | null = null;
  const ghToken = process.env.GITHUB_ISSUES_TOKEN;
  const ghRepo = process.env.GITHUB_ISSUES_REPO || "spectrahelix/northedm";
  if (ghToken) {
    try {
      const errs = Array.isArray(consoleErrors) ? consoleErrors : [];
      const body = [
        description,
        "",
        `**What they were doing:** ${doingWhat}`,
        `**Page (reported):** ${pageManual || "—"}`,
        `**Page (captured):** ${pageUrl || "—"}`,
        `**Reporter:** ${reporterName || email || (user?.id ? `user ${user.id}` : "anonymous")}`,
        `**Contact:** ${contactConsent
          ? [contactEmail, contactPhone, contactDm ? "NorthEDM DM" : ""].filter(Boolean).join(" · ") || "consented"
          : "no consent to contact"}`,
        `**Browser:** ${userAgent || "—"}`,
        `**Viewport:** ${viewport || "—"}`,
        screenshotUrl ? `\n![screenshot](${screenshotUrl})` : "",
        errs.length ? `\n**JS errors:**\n\`\`\`\n${JSON.stringify(errs, null, 2).slice(0, 4000)}\n\`\`\`` : "",
        `\n<sub>Auto-filed from a user "Report a problem" (report ${report.id}).</sub>`,
      ].join("\n");
      const res = await fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ title: `[User report] ${title.slice(0, 90)}`, body, labels: ["user-report"] }),
      });
      if (res.ok) {
        const issue = await res.json();
        githubIssueUrl = issue.html_url ?? null;
        if (githubIssueUrl) await admin.from("error_reports").update({ github_issue_url: githubIssueUrl }).eq("id", report.id);
      }
    } catch (e) {
      console.error("github issue creation failed:", e);
    }
  }

  // Alert with enough context to triage straight from the email/push.
  const contactLine = contactConsent
    ? [contactEmail, contactPhone, contactDm ? "NorthEDM DM" : ""].filter(Boolean).join(" · ") || "consented (no details)"
    : "did NOT consent to contact";
  await notifyFeedback({
    message: [
      `${title}`,
      ``,
      `Page: ${pageManual || pageUrl || "—"}`,
      `From: ${reporterName || email || "anonymous"} — ${contactLine}`,
      ``,
      `What went wrong: ${description}`,
      `Doing at the time: ${doingWhat}`,
      screenshotUrl ? `\nScreenshot: ${screenshotUrl}` : "",
      githubIssueUrl ? `Issue: ${githubIssueUrl}` : "",
    ].filter(Boolean).join("\n"),
    category: "Bug report",
    email: email || undefined,
  });

  return NextResponse.json({ ok: true, githubIssueUrl });
}
