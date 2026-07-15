import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

// Admin triage for user "Report a problem" submissions.
export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { data, error } = await g.admin
    .from("error_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!id || !["new", "triaged", "fixed", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { error } = await g.admin.from("error_reports").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
