import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, isSiteAdminUser } from "@/utils/coordinator";
import { maskBridge, type BridgeRow } from "@/utils/bridge";

async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = serviceClient();
  if (!(await isSiteAdminUser(admin, user))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { admin, user };
}

// GET — every coordinator's bridge intake, secrets masked, for the owner's review.
export async function GET() {
  const g = await guard(); if ("error" in g) return g.error;
  const { data } = await g.admin.from("coordinator_bridge").select("*").order("updated_at", { ascending: false });
  const rows = (data ?? []) as BridgeRow[];
  const { data: names } = rows.length ? await g.admin.from("festdash_promoters").select("user_id, display_name").in("user_id", rows.map((r) => r.user_id)) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.user_id as string, n.display_name as string | null]));
  return NextResponse.json({ bridges: rows.map((r) => ({ ...maskBridge(r), display_name: nameOf.get(r.user_id) ?? null })) });
}

// POST { user_id, status?: "draft" | "submitted" | "verified" | "live", owner_notes? }
export async function POST(req: Request) {
  const g = await guard(); if ("error" in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id || "");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (["draft", "submitted", "verified", "live"].includes(body.status)) {
    patch.status = body.status;
    if (body.status === "verified" || body.status === "live") patch.verified_at = new Date().toISOString();
  }
  if (typeof body.owner_notes === "string") patch.owner_notes = body.owner_notes.trim().slice(0, 1000) || null;
  const { data, error } = await g.admin.from("coordinator_bridge").update(patch).eq("user_id", userId).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No intake for that coordinator yet." }, { status: 404 });
  return NextResponse.json({ ok: true, bridge: maskBridge(data as BridgeRow) });
}
