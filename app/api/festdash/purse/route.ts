import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, coordinatorFor, loadSplitSettings } from "@/utils/coordinator";

// The purse keeper's console data. Everything a coordinator needs to run their
// region: their wallets, the shops they signed up (with fee status), wallet
// orders waiting for their confirmation, their ledger, and what they owe the
// owner. Reads with the service role after the coordinator check — RLS already
// scopes these tables to the coordinator, but the vendor/order joins are simpler
// in one place.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = serviceClient();
  const me = await coordinatorFor(admin, user.id);
  if (!me) return NextResponse.json({ coordinator: null });

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: vendors }, settings] = await Promise.all([
    admin.from("vendors").select("id, name, category, currency, whatsapp_number, suspended_at, payout_wallets, area").eq("coordinator_user_id", user.id).order("name"),
    loadSplitSettings(admin),
  ]);
  const vendorIds = (vendors ?? []).map((v) => Number(v.id));

  const [{ data: subs }, { data: fd }, { data: awaiting }, { data: ledger }] = await Promise.all([
    vendorIds.length
      ? admin.from("vendor_subscriptions").select("vendor_id, period_start, period_end, created_at").eq("kind", "festdash").in("vendor_id", vendorIds).order("period_end", { ascending: false })
      : Promise.resolve({ data: [] as { vendor_id: number; period_start: string; period_end: string; created_at: string }[] }),
    vendorIds.length
      ? admin.from("festdash_vendors").select("vendor_id, is_active").in("vendor_id", vendorIds)
      : Promise.resolve({ data: [] as { vendor_id: number; is_active: boolean }[] }),
    vendorIds.length
      ? admin.from("festdash_orders")
          .select("id, vendor_id, customer_name, total_cents, currency, payment_method, payment_ref, payment_to, created_at, items")
          .in("vendor_id", vendorIds).eq("status", "awaiting_confirmation").order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    admin.from("coordinator_ledger").select("*").eq("coordinator_user_id", user.id).order("created_at", { ascending: false }).limit(200),
  ]);

  const latestSub = new Map<number, { period_start: string; period_end: string }>();
  for (const s of subs ?? []) if (!latestSub.has(Number(s.vendor_id))) latestSub.set(Number(s.vendor_id), s);
  const fdActive = new Map((fd ?? []).map((r) => [Number(r.vendor_id), !!r.is_active]));
  const vendorName = new Map((vendors ?? []).map((v) => [Number(v.id), String(v.name ?? `Vendor #${v.id}`)]));

  const shops = (vendors ?? []).map((v) => {
    const sub = latestSub.get(Number(v.id)) ?? null;
    return {
      id: Number(v.id), name: v.name, category: v.category, currency: v.currency, whatsapp_number: v.whatsapp_number,
      payout_wallets: v.payout_wallets ?? null, area: v.area ?? null,
      suspended: !!v.suspended_at, festdash_active: fdActive.get(Number(v.id)) ?? false,
      paid_through: sub?.period_end ?? null, fee_current: !!sub && sub.period_end >= today,
    };
  });

  // Totals per currency: what the coordinator has earned, and what they owe the
  // owner (owner's share of sales + fees, minus everything already sent).
  const totals: Record<string, { earned: number; owner_share: number; sent: number; owed: number }> = {};
  for (const row of ledger ?? []) {
    const c = String(row.currency || "USD");
    totals[c] ??= { earned: 0, owner_share: 0, sent: 0, owed: 0 };
    if (row.kind === "remittance") totals[c].sent += Number(row.gross_cents);
    else { totals[c].earned += Number(row.coordinator_cents); totals[c].owner_share += Number(row.owner_cents); }
  }
  for (const c of Object.keys(totals)) totals[c].owed = totals[c].owner_share - totals[c].sent;

  return NextResponse.json({
    coordinator: me,
    settings,
    shops,
    awaiting: (awaiting ?? []).map((o) => ({ ...o, vendor_name: vendorName.get(Number(o.vendor_id)) ?? `Vendor #${o.vendor_id}` })),
    ledger: (ledger ?? []).map((r) => ({ ...r, vendor_name: r.vendor_id ? vendorName.get(Number(r.vendor_id)) ?? null : null })),
    totals,
  });
}

// POST — the coordinator updates their own wallet numbers.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = serviceClient();
  const me = await coordinatorFor(admin, user.id);
  if (!me) return NextResponse.json({ error: "Not a coordinator." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 40) || null : null);
  const patch = {
    wave_number: clean(body.wave_number),
    qmoney_number: clean(body.qmoney_number),
    afrimoney_number: clean(body.afrimoney_number),
    whatsapp_number: clean(body.whatsapp_number),
    remitly_name: typeof body.remitly_name === "string" ? body.remitly_name.trim().slice(0, 80) || null : null,
  };
  const { data, error } = await admin.from("festdash_promoters").update(patch).eq("id", me.id).select("wave_number, qmoney_number, afrimoney_number, whatsapp_number, remitly_name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wallets: data });
}
