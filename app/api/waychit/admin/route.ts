import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { PAYOUT_CHANNELS, waychitState } from "@/utils/waychit";
import { sendWaychitPayout } from "@/utils/waychitOrders";

// Owner's Waychit panel: the switch, the fee, and the payouts queue.
export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const [state, { data: payouts }, { data: vendors }] = await Promise.all([
    waychitState(g.admin),
    g.admin.from("waychit_payouts").select("*").order("created_at", { ascending: false }).limit(200),
    g.admin.from("vendors").select("id, name"),
  ]);
  const names = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  return NextResponse.json({ state, payouts: (payouts ?? []).map((p) => ({ ...p, vendor_name: names.get(p.vendor_id) ?? null })) });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await req.json().catch(() => ({}));
  if (body.action === "settings") {
    const patch: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") {
      if (body.enabled && !(await waychitState(g.admin)).keys) return NextResponse.json({ error: "Add WAYCHIT_API_KEY and WAYCHIT_WEBHOOK_SECRET in Vercel first." }, { status: 400 });
      patch.waychit_enabled = body.enabled;
    }
    const bps = Math.round(Number(body.fee_bps));
    if (body.fee_bps !== undefined) { if (!Number.isFinite(bps) || bps < 0 || bps > 1000) return NextResponse.json({ error: "Fee must be 0–10%." }, { status: 400 }); patch.waychit_fee_bps = bps; }
    if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to change" }, { status: 400 });
    const { error } = await g.admin.from("coordinator_program_settings").update(patch).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ state: await waychitState(g.admin) });
  }
  if (body.action === "set_destination") {
    const channel = String(body.channel ?? "");
    const destination = String(body.destination ?? "").trim().slice(0, 40);
    if (!(PAYOUT_CHANNELS as readonly string[]).includes(channel) || !destination) return NextResponse.json({ error: "Pick Wave, QMoney, Afrimoney or bank and enter the number." }, { status: 400 });
    const { data, error } = await g.admin.from("waychit_payouts").update({ channel, destination, updated_at: new Date().toISOString() })
      .eq("id", String(body.id ?? "")).in("status", ["owed", "failed"]).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Only an unsent or failed payout can change." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "send") {
    if (!(await waychitState(g.admin)).enabled) return NextResponse.json({ error: "Waychit is switched off." }, { status: 400 });
    const r = await sendWaychitPayout(g.admin, String(body.id ?? ""), g.userId);
    return NextResponse.json(r, { status: "error" in r ? 400 : 200 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
