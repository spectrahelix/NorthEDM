import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notifyFeedback } from "@/utils/alerts";
import { screenEmail, looksLikeGarbageText } from "@/utils/botEmail";

// Sign-in help — the ONE submission path deliberately open to guests.
//
// Everything else that writes user content (requests, bug reports, feedback,
// show listings) now requires a verified account. That rule cannot apply here:
// the people who need this form are, by definition, the ones who can't get into
// an account. So it stays open and is screened on content instead
// (utils/botEmail.ts), plus a honeypot field below.
//
// Screening is deliberately narrow. A junk row costs one click to dismiss; a
// false positive locks a real person out of the only door they have left.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Honeypot: a field hidden from humans by CSS. Anything that fills it is
  // filling the form programmatically. Answer 200 so a bot learns nothing from
  // the response, but write nothing.
  if (String(body.website || "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const verdict = screenEmail(String(body.email || ""));
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 400 });
  }
  const email = verdict.email;

  const description = String(body.description || "").trim().slice(0, 2000);
  if (looksLikeGarbageText(description)) {
    return NextResponse.json(
      { error: "Could you describe the problem in a few plain words?" },
      { status: 400 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Stored in error_reports so it lands in /admin/bug-reports alongside
  // everything else, tagged source='signin-help' so it is filterable.
  const { error } = await admin.from("error_reports").insert({
    title: "Trouble signing in",
    description: description || "(no description given)",
    contact_email: email,
    contact_consent: true, // they typed their address asking to be contacted
    page_url: "/signin-help",
    source: "signin-help",
    status: "new",
    user_agent: String(body.userAgent || "").slice(0, 400),
  });

  if (error) {
    console.error("signin-help insert error:", error.message);
    return NextResponse.json({ error: "Couldn't send that. Please try again." }, { status: 500 });
  }

  // Alert the owner. Someone locked out is time-sensitive in a way a feature
  // request isn't — they are trying to become a user right now and can't.
  await notifyFeedback({
    message: `🔐 SIGN-IN HELP — ${email}\n\n${description || "(no description given)"}`,
    category: "signin-help",
    email,
  }).catch((e) => console.error("signin-help alert failed:", e));

  return NextResponse.json({ ok: true });
}
