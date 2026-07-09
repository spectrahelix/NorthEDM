import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

// Admin: approve or reject a Marketplace application. Approving grants paid
// marketplace access (is_marketplace) — the DB-guarded flag — and marks the
// application approved.
export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const appId = String(body.appId || "");
  const action = String(body.action || "");
  if (!appId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { data: app } = await g.admin
    .from("marketplace_applications")
    .select("user_id")
    .eq("id", appId)
    .single();
  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const { error: statusErr } = await g.admin
    .from("marketplace_applications")
    .update({ status: action === "approve" ? "approved" : "rejected" })
    .eq("id", appId);
  if (statusErr) return NextResponse.json({ error: statusErr.message }, { status: 500 });

  if (action === "approve" && app.user_id) {
    const { error } = await g.admin
      .from("user_profiles")
      .update({ is_marketplace: true })
      .eq("id", app.user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
