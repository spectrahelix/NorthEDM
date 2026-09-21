import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notifyFeedback } from "@/utils/alerts";
import { validateField } from "@/utils/reportQuality";
import { requireVerifiedUser } from "@/utils/authGate";

// Receives beta-tester feedback from /feedback. Persists it to error_reports so
// it shows up alongside "Report a problem" submissions in /admin/bug-reports,
// then fans out to the owner (email + phone push + in-app).
//
// VERIFIED ACCOUNTS ONLY. This was open to anyone, which is how the keyboard-mash
// submissions got in. Someone who cannot reach an account should use /signin-help,
// the one guest-open path.
export async function POST(req: Request) {
  const supabaseGate = await createClient();
  const gate = await requireVerifiedUser(supabaseGate);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  const category = String(body.category || "").trim().slice(0, 40);
  const email = String(body.email || "").trim().slice(0, 200);

  if (message.length > 4000) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  }
  // Same quality gate as bug reports — this form was the source of keyboard-mash
  // submissions that told the owner nothing. Conservative: real text always passes.
  const problem = validateField(message, "Your message", { min: 12, minWords: 2 });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const user = gate.user;

  // Store it where the owner already looks. The category is prefixed onto the
  // description and echoed into page_url so a Bug/Idea/Praise from the feedback
  // form is distinguishable from a 🐞 "Report a problem" submission.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error } = await admin.from("error_reports").insert({
    user_id: user?.id ?? null,
    email: email || user?.email || null,
    title: category ? `[${category}] feedback` : "Feedback",
    description: category ? `[${category}] ${message}` : message,
    source: "feedback",
    page_url: `Feedback form${category ? ` · ${category}` : ""}`,
  });
  if (error) {
    return NextResponse.json({ error: "Couldn't save your feedback. Try again." }, { status: 500 });
  }

  await notifyFeedback({ message, category, email });
  return NextResponse.json({ ok: true });
}
