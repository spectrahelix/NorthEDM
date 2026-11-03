import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, coordinatorFor } from "@/utils/coordinator";
import { cleanBridgePatch, loadBridge, maskBridge } from "@/utils/bridge";
import { notifyBridgeSubmitted } from "@/utils/alerts";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = serviceClient();
  const coord = await coordinatorFor(admin, user.id);
  if (!coord) return { error: NextResponse.json({ error: "Not a coordinator" }, { status: 403 }) };
  return { user, admin, coord };
}

// GET — the coordinator's own bridge row, secrets masked.
export async function GET() {
  const m = await me(); if ("error" in m) return m.error;
  return NextResponse.json({ bridge: maskBridge(await loadBridge(m.admin, m.user.id)) });
}

// POST { ...fields, action?: "save" | "submit" } — save details; "submit"
// marks them ready and tells the owner. Blank fields leave saved values alone.
export async function POST(req: Request) {
  const m = await me(); if ("error" in m) return m.error;
  const body = await req.json().catch(() => ({}));
  const patch = cleanBridgePatch(body);
  const existing = await loadBridge(m.admin, m.user.id);
  const submit = body.action === "submit";
  if (submit) {
    const merged = { ...(existing ?? {}), ...patch } as Record<string, unknown>;
    const need = ["business_name", "bank_name", "bank_account_name", "bank_account_number"].filter((k) => !merged[k]);
    if (need.length) return NextResponse.json({ error: `Still needed before submitting: ${need.map((k) => k.replace(/_/g, " ")).join(", ")}.` }, { status: 400 });
    patch.status = "submitted"; patch.submitted_at = new Date().toISOString();
  } else if (existing?.status === "verified" || existing?.status === "live") {
    // Editing verified details sends them back for review.
    if (Object.keys(patch).length) patch.status = "submitted";
  }
  patch.updated_at = new Date().toISOString();
  const { data, error } = await m.admin.from("coordinator_bridge").upsert({ user_id: m.user.id, ...patch }, { onConflict: "user_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (submit) await notifyBridgeSubmitted({ name: m.coord.display_name ?? m.user.email ?? m.user.id, provider: String(data.provider) }).catch(() => {});
  return NextResponse.json({ ok: true, bridge: maskBridge(data) });
}
