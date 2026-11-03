import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { enrollCoordinatorShop } from "@/utils/coordinator";

// Owner's controls for the coordinator model. GET returns everything the admin
// page shows; PATCH applies one change at a time.
export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const admin = g.admin;
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: promoters }, { data: vendors }, { data: subs }, { data: ledger }, { data: settings }] = await Promise.all([
    admin.from("festdash_promoters").select("id, user_id, display_name, is_active, is_coordinator, region, wave_number, qmoney_number, afrimoney_number, whatsapp_number, remitly_name").order("display_name"),
    admin.from("vendors").select("id, name, status, is_public, suspended_at, coordinator_user_id, region, currency, whatsapp_number").eq("status", "approved").order("name"),
    admin.from("vendor_subscriptions").select("vendor_id, period_end").eq("kind", "festdash").gte("period_end", today),
    admin.from("coordinator_ledger").select("*").order("created_at", { ascending: false }).limit(300),
    admin.from("coordinator_program_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  // Commissions still owed to each coordinator (fees paid by card, US-side sales) — part of the net.
  const { data: heldRows } = await admin.from("commissions").select("promoter_user_id, amount_cents").eq("status", "held");
  const heldByUser: Record<string, number> = {};
  for (const r of heldRows ?? []) heldByUser[r.promoter_user_id] = (heldByUser[r.promoter_user_id] ?? 0) + Number(r.amount_cents);
  const paidThrough = new Map<number, string>();
  for (const s of subs ?? []) {
    const cur = paidThrough.get(Number(s.vendor_id));
    if (!cur || s.period_end > cur) paidThrough.set(Number(s.vendor_id), s.period_end);
  }
  return NextResponse.json({
    promoters: promoters ?? [],
    vendors: (vendors ?? []).map((v) => ({ ...v, paid_through: paidThrough.get(Number(v.id)) ?? null })),
    ledger: ledger ?? [],
    settings,
    held_commissions: heldByUser,
  });
}

export async function PATCH(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const admin = g.admin;
  const body = await req.json().catch(() => ({}));

  if (body.action === "set_coordinator") {
    const promoterId = String(body.promoterId ?? "");
    const on = !!body.isCoordinator;
    const region = typeof body.region === "string" ? body.region.trim().toLowerCase().slice(0, 40) || null : null;
    if (!promoterId) return NextResponse.json({ error: "promoterId required" }, { status: 400 });
    const { data, error } = await admin.from("festdash_promoters")
      .update({ is_coordinator: on, region: on ? region : null })
      .eq("id", promoterId).select("id, is_coordinator, region").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ promoter: data });
  }

  if (body.action === "assign_vendor") {
    const vendorId = Number(body.vendorId);
    const coordinatorUserId = body.coordinatorUserId ? String(body.coordinatorUserId) : null;
    const currency = typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency) ? body.currency : "USD";
    const region = typeof body.region === "string" ? body.region.trim().toLowerCase().slice(0, 40) || null : null;
    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim().slice(0, 40) || null : null;
    if (!vendorId) return NextResponse.json({ error: "vendorId required" }, { status: 400 });
    if (coordinatorUserId) {
      const { data: c } = await admin.from("festdash_promoters").select("id").eq("user_id", coordinatorUserId).eq("is_coordinator", true).maybeSingle();
      if (!c) return NextResponse.json({ error: "That account isn't a coordinator." }, { status: 400 });
    }
    const { data, error } = await admin.from("vendors")
      .update({ coordinator_user_id: coordinatorUserId, currency: coordinatorUserId ? currency : "USD", region: coordinatorUserId ? region : null, whatsapp_number: whatsapp })
      .eq("id", vendorId).select("id, coordinator_user_id, currency, region, whatsapp_number").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // An already-approved vendor assigned to a coordinator used to stay off
    // FestDash entirely — nothing enrolled it, so fees could be logged and the
    // shop still never appeared. Enrol it here too (no-op unless approved).
    const enrolled = coordinatorUserId ? await enrollCoordinatorShop(admin, vendorId) : false;
    return NextResponse.json({ vendor: data, enrolled });
  }

  if (body.action === "confirm_remittance") {
    const id = String(body.id ?? "");
    const receivedUsd = Number(body.receivedUsd);
    if (!id || !Number.isFinite(receivedUsd) || receivedUsd < 0) return NextResponse.json({ error: "id and receivedUsd required" }, { status: 400 });
    const { data, error } = await admin.from("coordinator_ledger")
      .update({ received_at: new Date().toISOString(), received_usd_cents: Math.round(receivedUsd * 100), received_by: g.userId })
      .eq("id", id).eq("kind", "remittance").select("id, received_at, received_usd_cents").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ remittance: data });
  }

  // Owner → coordinator, for card sales on Gambian shops (collected_by = 'owner'):
  // the owner sent the shop/coordinator/runner shares by Remitly and records it.
  if (body.action === "log_payout") {
    const coordinatorUserId = String(body.coordinatorUserId ?? "");
    const currency = String(body.currency ?? "GMD").toUpperCase().slice(0, 3);
    const amount = Number(body.amount);
    if (!coordinatorUserId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "coordinatorUserId and amount required" }, { status: 400 });
    const { data, error } = await admin.from("coordinator_ledger").insert({
      kind: "payout", coordinator_user_id: coordinatorUserId, collected_by: "owner", currency,
      gross_cents: Math.round(amount * 100), method: "remitly", reference: body.reference ? String(body.reference).slice(0, 80) : null,
      note: body.note ? String(body.note).slice(0, 300) : null, created_by: g.userId,
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ payout: data });
  }

  if (body.action === "set_settings") {
    const n = (v: unknown, lo: number, hi: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };
    const patch: Record<string, number> = {};
    const so = n(body.sale_owner_bps, 0, 5000), sc = n(body.sale_coordinator_bps, 0, 5000), fee = n(body.subscription_fee_cents, 0, 1_000_000), sub = n(body.subscription_coordinator_bps, 0, 10000);
    if (so != null) patch.sale_owner_bps = so; if (sc != null) patch.sale_coordinator_bps = sc;
    // The promoter's part comes OUT of the platform share; it can never exceed it.
    {
      const { data: cur } = await admin.from("coordinator_program_settings").select("sale_owner_bps, sale_coordinator_bps").eq("id", 1).maybeSingle();
      const owner = so ?? Number(cur?.sale_owner_bps ?? 1000), coord = sc ?? Number(cur?.sale_coordinator_bps ?? 500);
      if (coord > owner) return NextResponse.json({ error: "The promoter's part can't be more than the platform's share of the sale." }, { status: 400 });
    }
    if (fee != null) patch.subscription_fee_cents = fee; if (sub != null) patch.subscription_coordinator_bps = sub;
    const bundle = n(body.bundle_fee_cents, 0, 1_000_000), mp = n(body.mint_max_percent_off, 0, 100), ma = n(body.mint_max_amount_off_cents, 0, 1_000_000), dx = n(body.delivery_extra_bps, 0, 5000);
    if (dx != null) patch.delivery_extra_bps = dx;
    if (bundle != null) patch.bundle_fee_cents = bundle; if (mp != null) patch.mint_max_percent_off = mp; if (ma != null) patch.mint_max_amount_off_cents = ma;
    if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to change" }, { status: 400 });
    const { data, error } = await admin.from("coordinator_program_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
