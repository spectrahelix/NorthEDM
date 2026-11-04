import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveMyVendor } from "@/utils/myVendor";
import { loadWalletWatch } from "@/utils/walletWatch";
import { notifyWalletIssue } from "@/utils/alerts";
import { orderRef } from "@/utils/gambiaPay";

// A shop's view of the money its coordinator collected for it: every wallet
// sale booked in the ledger (last 90 days) with the shop's share, plus wallet
// payments for its orders that are unconfirmed, rejected or reported. So a
// shop that is short-paid can see it and tell the owner directly.
async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const v = await resolveMyVendor(user.id);
  if (!v) return { error: NextResponse.json({ error: "No shop linked to this account" }, { status: 403 }) };
  return { user, v };
}
export async function GET() {
  const m = await me(); if ("error" in m) return m.error;
  const { admin, vendorId } = m.v;
  const since = new Date(Date.now() - 90 * 86400e3).toISOString();
  const { data: sales } = await admin.from("coordinator_ledger")
    .select("id, created_at, order_id, store_order_id, currency, gross_cents, shop_cents, method, reference")
    .eq("vendor_id", vendorId).eq("kind", "sale").eq("collected_by", "coordinator").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(300);
  const rows = (sales ?? []).map((s) => ({ ...s, order_ref: orderRef(String(s.order_id ?? s.store_order_id ?? s.id)) }));
  const totals: Record<string, { gross: number; shop: number; count: number }> = {};
  for (const r of rows) { const t = (totals[r.currency] ??= { gross: 0, shop: 0, count: 0 }); t.gross += Number(r.gross_cents ?? 0); t.shop += Number(r.shop_cents ?? 0); t.count++; }
  const concerns = (await loadWalletWatch(admin, { vendorId })).map((c) => ({ ref: c.ref, state: c.state, amount_cents: c.amount_cents, currency: c.currency, method: c.method, created_at: c.created_at }));
  return NextResponse.json({ sales: rows, totals, concerns });
}
// POST { note } — the shop reports a payment it didn't receive from its coordinator.
export async function POST(req: Request) {
  const m = await me(); if ("error" in m) return m.error;
  const body = await req.json().catch(() => ({}));
  const note = String(body.note ?? "").trim().slice(0, 800);
  if (!note) return NextResponse.json({ error: "Say which sale or amount is missing." }, { status: 400 });
  const name = String((m.v.vendor as { name?: string | null }).name ?? `vendor ${m.v.vendorId}`);
  await notifyWalletIssue({ title: `Shop reports missing money · ${name}`, message: `${name} (vendor ${m.v.vendorId}, ${m.user.email ?? "no email"}) says: "${note}"` });
  return NextResponse.json({ ok: true });
}
