import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { sendEmail } from "@/utils/authEmail";
import { suggestUsername } from "@/utils/username";

// Admin action: email every account that has no username and has never been
// nudged a one-time "pick your username" note. After they sign in, the layout's
// UsernamePrompt does the rest. GET previews the list; POST sends and stamps
// username_nudged_at so nobody is emailed twice. Internal addresses are skipped.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.northedm.com").replace(/\/$/, "");
const INTERNAL = /@northedm\.com$/i;

type Candidate = { id: string; display_name: string | null; email: string };

async function candidates(admin: Awaited<ReturnType<typeof adminGuard>> extends infer G ? (G extends { ok: true; admin: infer A } ? A : never) : never): Promise<Candidate[]> {
  const { data } = await admin
    .from("user_profiles")
    .select("id, display_name")
    .is("username", null)
    .is("username_chosen_at", null)
    .is("username_nudged_at", null)
    .order("created_at", { ascending: true });
  const out: Candidate[] = [];
  for (const p of data ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(p.id as string);
    const email = u?.user?.email ?? null;
    if (!email || INTERNAL.test(email)) continue;
    out.push({ id: p.id as string, display_name: (p.display_name as string | null) ?? null, email });
  }
  return out;
}

function message(c: Candidate) {
  const name = c.display_name && c.display_name !== c.email ? c.display_name : "there";
  const suggestion = suggestUsername(c.email);
  const link = `${SITE}/login?next=%2Ffeed`;
  const subject = "Pick your NorthEDM username";
  const text =
    `Hi ${name},\n\n` +
    `Your NorthEDM account doesn't have a username yet. It's how you appear on the forum, on FestDash and on your shop.\n\n` +
    `Sign in and we'll ask you to pick one${suggestion ? ` (we'll suggest @${suggestion}, and you can keep it with one tap)` : ""}:\n${link}\n\n` +
    `It takes about ten seconds.\n\n— NorthEDM\n\nYou're getting this one-time note because your account was created before usernames were asked for. NorthEDM LLC · ${SITE}`;
  const html = `<div style="background:#050505;padding:32px 16px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;background:#0d0d10;border:1px solid #222;border-radius:16px;padding:28px;color:#e5e5e5">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#f97316">NorthEDM</p>
<h1 style="margin:0 0 14px;font-size:26px;line-height:1.15;color:#fff">Pick your NorthEDM username</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Your account doesn't have a username yet. It's how you appear on the forum, on FestDash and on your shop.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Sign in and we'll ask you to pick one${suggestion ? ` (we'll suggest <span style="font-family:Menlo,Consolas,monospace;color:#fff">@${escapeHtml(suggestion)}</span>, and you can keep it with one tap)` : ""}. It takes about ten seconds.</p>
<p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Choose my username</a></p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a">You're getting this one-time note because your account was created before usernames were asked for. NorthEDM LLC · <a href="${SITE}" style="color:#8a8a8a">${SITE.replace(/^https?:\/\//, "")}</a></p>
</div></div>`;
  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
}

export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const list = await candidates(g.admin);
  return NextResponse.json({ count: list.length, people: list.map((c) => ({ display_name: c.display_name, email: c.email })) });
}

export async function POST() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const list = await candidates(g.admin);
  let sent = 0;
  const failed: { email: string; error: string }[] = [];
  for (const c of list) {
    const m = message(c);
    const r = await sendEmail({ to: c.email, subject: m.subject, html: m.html, text: m.text });
    if (r.ok) {
      sent++;
      await g.admin.from("user_profiles").update({ username_nudged_at: new Date().toISOString() }).eq("id", c.id);
    } else {
      failed.push({ email: c.email, error: r.error ?? "send failed" });
    }
  }
  return NextResponse.json({ sent, failed, total: list.length });
}
