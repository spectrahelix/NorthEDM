import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, coordinatorFor } from "@/utils/coordinator";
import { loadBridge, maskBridge, saveBridge } from "@/utils/bridge";
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

// GET — the coordinator's own bridge row (vendor_id null), secrets masked.
export async function GET() {
  const m = await me(); if ("error" in m) return m.error;
  return NextResponse.json({ bridge: maskBridge(await loadBridge(m.admin, { userId: m.user.id, vendorId: null })) });
}

// POST { ...fields, action?: "save" | "submit" } — see utils/bridge.ts saveBridge.
export async function POST(req: Request) {
  const m = await me(); if ("error" in m) return m.error;
  const body = await req.json().catch(() => ({}));
  const r = await saveBridge(m.admin, { userId: m.user.id, vendorId: null }, body);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.submitted) await notifyBridgeSubmitted({ name: m.coord.display_name ?? m.user.email ?? m.user.id, provider: String(r.row.provider), kind: "coordinator" }).catch(() => {});
  return NextResponse.json({ ok: true, bridge: maskBridge(r.row) });
}
