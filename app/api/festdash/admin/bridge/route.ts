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
  const vendorIds = rows.map((r) => r.vendor_id).filter((v): v is number => v != null);
  const [{ data: names }, { data: vendors }] = await Promise.all([
    rows.length ? g.admin.from("festdash_promoters").select("user_id, display_name").in("user_id", rows.map((r) => r.user_id)) : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] }),
    vendorIds.length ? g.admin.from("vendors").select("id, name").in("id", vendorIds) : Promise.resolve({ data: [] as { id: number; name: string | null }[] }),
  ]);
  const nameOf = new Map((names ?? []).map((n) => [n.user_id as string, n.display_name as string | null]));
  const vendorName = new Map((vendors ?? []).map((v) => [Number(v.id), v.name as string | null]));
  return NextResponse.json({ bridges: rows.map((r) => ({ ...maskBridge(r), display_name: r.vendor_id != null ? `${vendorName.get(r.vendor_id) ?? `vendor ${r.vendor_id}`} (shop)` : `${nameOf.get(r.user_id) ?? r.user_id.slice(0, 8)} (coordinator)` })) });
}

// POST { user_id, status?: "draft" | "submitted" | "verified" | "live", owner_notes? }
export async function POST(req: Request) {
  const g = await guard(); if ("error" in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (["draft", "submitted", "verified", "live"].includes(body.status)) {
    patch.status = body.status;
    if (body.status === "verified" || body.status === "live") patch.verified_at = new Date().toISOString();
  }
  if (typeof body.owner_notes === "string") patch.owner_notes = body.owner_notes.trim().slice(0, 1000) || null;
  const { data, error } = await g.admin.from("coordinator_bridge").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No intake for that coordinator yet." }, { status: 404 });
  return NextResponse.json({ ok: true, bridge: maskBridge(data as BridgeRow) });
}
