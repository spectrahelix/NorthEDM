import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notifyFeedback } from "@/utils/alerts";

// "Report a problem": stores a user's bug report (screenshot + auto-captured
// page/browser/error context) and alerts the owner. Anyone can report. If a
// GitHub issues token is configured, it also opens a ready-to-fix issue.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const description = String(form.get("description") || "").trim().slice(0, 4000);
  const pageUrl = String(form.get("pageUrl") || "").slice(0, 500);
  const userAgent = String(form.get("userAgent") || "").slice(0, 400);
  const viewport = String(form.get("viewport") || "").slice(0, 40);
  const email = String(form.get("email") || "").trim().slice(0, 160) || user?.email || null;
  let consoleErrors: unknown = [];
  try { consoleErrors = JSON.parse(String(form.get("consoleErrors") || "[]")); } catch { /* ignore */ }

  if (!description && !form.get("file")) {
    return NextResponse.json({ error: "Add a description or a screenshot." }, { status: 400 });
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
      description,
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
        description || "_No description provided._",
        "",
        `**Page:** ${pageUrl || "—"}`,
        `**Reporter:** ${email || (user?.id ? `user ${user.id}` : "anonymous")}`,
        `**Browser:** ${userAgent || "—"}`,
        `**Viewport:** ${viewport || "—"}`,
        screenshotUrl ? `\n![screenshot](${screenshotUrl})` : "",
        errs.length ? `\n**JS errors:**\n\`\`\`\n${JSON.stringify(errs, null, 2).slice(0, 4000)}\n\`\`\`` : "",
        `\n<sub>Auto-filed from a user "Report a problem" (report ${report.id}).</sub>`,
      ].join("\n");
      const res = await fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ title: `[User report] ${(description || "Issue").slice(0, 70)}`, body, labels: ["user-report"] }),
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

  await notifyFeedback({
    message: `${description || "(no description)"}\n\nPage: ${pageUrl}${screenshotUrl ? `\nScreenshot: ${screenshotUrl}` : ""}${githubIssueUrl ? `\nIssue: ${githubIssueUrl}` : ""}`,
    category: "Bug report",
    email: email || undefined,
  });

  return NextResponse.json({ ok: true, githubIssueUrl });
}
