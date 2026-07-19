import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { connectorStatus } from "@/utils/socialConnectors";

// Admin API for the Socials feature: manage the accounts shown on /social,
// see connector status, and view recent broadcasts.
export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const [{ data: accounts }, { data: posts }] = await Promise.all([
    g.admin.from("social_accounts").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    g.admin.from("social_posts").select("id, text, image_url, results, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({ accounts: accounts ?? [], posts: posts ?? [], connectors: connectorStatus() });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "add") {
    const platform = String(body.platform || "").trim().toLowerCase().slice(0, 30);
    const url = String(body.url || "").trim().slice(0, 300);
    const label = String(body.label || "").trim().slice(0, 80) || null;
    if (!platform || !url) return NextResponse.json({ error: "Platform and URL are required." }, { status: 400 });
    const normalized = /^https?:\/\//.test(url) ? url : `https://${url}`;
    const { error } = await g.admin.from("social_accounts").insert({ platform, url: normalized, label });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle") {
    const id = String(body.id || "");
    const active = !!body.active;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await g.admin.from("social_accounts").update({ active }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await g.admin.from("social_accounts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
