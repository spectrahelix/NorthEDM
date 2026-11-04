import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveMyVendor } from "@/utils/myVendor";
import { loadBridge, maskBridge, saveBridge } from "@/utils/bridge";
import { notifyBridgeSubmitted } from "@/utils/alerts";

// A shop's own payment-bridge intake (one row per vendor). Same rules as the
// coordinator's: service role, secrets masked, blanks keep saved values.
async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const v = await resolveMyVendor(user.id);
  if (!v) return { error: NextResponse.json({ error: "No shop linked to this account" }, { status: 403 }) };
  return { user, admin: v.admin, vendorId: v.vendorId, vendorName: String((v.vendor as { name?: string | null }).name ?? "") };
}
export async function GET() {
  const m = await me(); if ("error" in m) return m.error;
  return NextResponse.json({ bridge: maskBridge(await loadBridge(m.admin, { userId: m.user.id, vendorId: m.vendorId })) });
}
export async function POST(req: Request) {
  const m = await me(); if ("error" in m) return m.error;
  const body = await req.json().catch(() => ({}));
  const r = await saveBridge(m.admin, { userId: m.user.id, vendorId: m.vendorId }, body);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.submitted) await notifyBridgeSubmitted({ name: m.vendorName || m.user.email || m.user.id, provider: String(r.row.provider), kind: "shop" }).catch(() => {});
  return NextResponse.json({ ok: true, bridge: maskBridge(r.row) });
}
