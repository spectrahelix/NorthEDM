import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const [{ data: settings, error: e1 }, { data: templates, error: e2 }] = await Promise.all([
    g.admin.from("welcome_dm_settings").select("*").eq("id", true).single(),
    g.admin.from("welcome_dm_templates").select("*").order("id"),
  ]);
  if (e1 || e2) return NextResponse.json({ error: e1?.message || e2?.message }, { status: 500 });
  return NextResponse.json({ settings, templates: templates || [], current_admin_id: g.userId });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  if (body.action === "settings") {
    if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Enabled must be a boolean." }, { status: 400 });
    const { error } = await g.admin.from("welcome_dm_settings").update({
      enabled: body.enabled, sender_id: g.userId, updated_at: new Date().toISOString(),
    }).eq("id", true);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (body.action === "template") {
    if (!Number.isInteger(body.id) || body.id < 1 || body.id > 4 || typeof body.subject !== "string" || typeof body.body !== "string" || typeof body.title !== "string" || typeof body.active !== "boolean")
      return NextResponse.json({ error: "Invalid template." }, { status: 400 });
    const subject = body.subject.trim(), message = body.body.trim(), title = body.title.trim();
    if (!subject || subject.length > 100 || !message || message.length > 3000 || !title || title.length > 100)
      return NextResponse.json({ error: "Check title, subject and body lengths." }, { status: 400 });
    const { error } = await g.admin.from("welcome_dm_templates").update({
      subject, body: message, title, active: body.active, updated_at: new Date().toISOString(),
    }).eq("id", body.id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
