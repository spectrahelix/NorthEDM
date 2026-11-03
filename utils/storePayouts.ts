import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";
import { loadSplitSettings } from "@/utils/coordinator";
import { platformShareBps } from "@/utils/gambiaPay";

/**
 * A vendor's Stripe Connect account. `vendors.stripe_account_id` is the home for
 * it since 2026-11-03; FestDash vendors who connected before then still carry it
 * on festdash_vendors, so both are read.
 */
export async function vendorStripeAccount(admin: SupabaseClient, vendorId: number): Promise<string | null> {
  const { data: v } = await admin.from("vendors").select("stripe_account_id").eq("id", vendorId).maybeSingle();
  if (v?.stripe_account_id) return v.stripe_account_id as string;
  const { data: f } = await admin.from("festdash_vendors").select("stripe_account_id").eq("vendor_id", vendorId).maybeSingle();
  return (f?.stripe_account_id as string | null) ?? null;
}

type Line = { product_id: number; vendor_id: number; price_cents: number; qty: number };

/** The charge id behind a paid Checkout session, needed so transfers draw on that charge. */
export async function chargeIdForPaymentIntent(paymentIntentId: string): Promise<string | null> {
  const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
  const lc = pi.latest_charge;
  return typeof lc === "string" ? lc : lc?.id ?? null;
}

/**
 * Book and pay the shares of one paid USD store order. Idempotent per
 * (order, payee, kind): a replayed webhook creates nothing twice, and the
 * transfer idempotency key means Stripe won't either.
 *
 * Split per selling vendor's lines: platform share (owner + coordinator bps,
 * 20% by default — the promoter's 10% is paid out of it by the commissions
 * machinery) and, for a vendor who isn't the store's operator, the store's
 * operator fee; the rest is the vendor's. Operator fees from member vendors
 * are paid to the operator's own vendor account.
 */
export async function payStoreOrder(admin: SupabaseClient, orderId: string, chargeId: string | null) {
  const { data: order } = await admin.from("store_orders")
    .select("id, store_id, items, currency, status, stripe_payment_intent").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "paid") return { ok: false as const, reason: "order not paid" };
  if (String(order.currency || "USD") !== "USD") return { ok: false as const, reason: "wallet-rail order — settled through the coordinator ledger" };
  const { data: store } = await admin.from("stores").select("owner_user_id, operator_fee_bps").eq("id", order.store_id).maybeSingle();
  const { data: op } = store?.owner_user_id
    ? await admin.from("user_profiles").select("vendor_id").eq("id", store.owner_user_id).maybeSingle()
    : { data: null };
  const operatorVendorId = op?.vendor_id ? Number(op.vendor_id) : null;
  const operatorBps = Math.max(0, Number(store?.operator_fee_bps ?? 0));
  const platformBps = platformShareBps(await loadSplitSettings(admin));

  const byVendor = new Map<number, number>();
  for (const l of (order.items ?? []) as Line[]) {
    const v = Number(l.vendor_id);
    byVendor.set(v, (byVendor.get(v) ?? 0) + Number(l.price_cents) * Number(l.qty));
  }
  const payees: { vendor_id: number; kind: "vendor" | "operator"; amount_cents: number }[] = [];
  let operatorTotal = 0;
  for (const [vendorId, lines] of byVendor) {
    const platform = Math.round((lines * platformBps) / 10000);
    const opFee = operatorVendorId && vendorId !== operatorVendorId ? Math.round((lines * operatorBps) / 10000) : 0;
    operatorTotal += opFee;
    const share = lines - platform - opFee;
    if (share > 0) payees.push({ vendor_id: vendorId, kind: "vendor", amount_cents: share });
  }
  if (operatorVendorId && operatorTotal > 0) payees.push({ vendor_id: operatorVendorId, kind: "operator", amount_cents: operatorTotal });

  const results: { vendor_id: number; kind: string; status: string }[] = [];
  for (const p of payees) {
    const { data: existing } = await admin.from("store_payouts").select("id, status")
      .eq("store_order_id", orderId).eq("vendor_id", p.vendor_id).eq("kind", p.kind).maybeSingle();
    if (existing) { results.push({ vendor_id: p.vendor_id, kind: p.kind, status: existing.status }); continue; }
    const account = await vendorStripeAccount(admin, p.vendor_id);
    const row = { store_order_id: orderId, vendor_id: p.vendor_id, kind: p.kind, amount_cents: p.amount_cents, currency: "USD", stripe_account_id: account };
    if (!account || !chargeId) {
      await admin.from("store_payouts").insert({ ...row, status: "owed", note: account ? "no charge id" : "no payout account yet" });
      results.push({ vendor_id: p.vendor_id, kind: p.kind, status: "owed" });
      continue;
    }
    const sent = await transfer(orderId, p.vendor_id, p.kind, p.amount_cents, account, chargeId);
    await admin.from("store_payouts").insert({
      ...row, status: sent.ok ? "paid" : "owed", stripe_transfer_id: sent.ok ? sent.id : null,
      paid_at: sent.ok ? new Date().toISOString() : null, note: sent.ok ? null : sent.reason,
    });
    results.push({ vendor_id: p.vendor_id, kind: p.kind, status: sent.ok ? "paid" : "owed" });
  }
  return { ok: true as const, results };
}

async function transfer(orderId: string, vendorId: number, kind: string, amount: number, destination: string, chargeId: string) {
  try {
    const t = await getStripe().transfers.create(
      { amount, currency: "usd", destination, source_transaction: chargeId, metadata: { kind: `store_${kind}`, store_order_id: orderId, vendor_id: String(vendorId) } },
      { idempotencyKey: `store_payout_${orderId}_${vendorId}_${kind}` }
    );
    return { ok: true as const, id: t.id };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`store payout transfer failed (order ${orderId}, vendor ${vendorId}):`, reason);
    return { ok: false as const, reason };
  }
}

/** Owed rows whose vendor has since connected: pay them. Run by the commissions cron. */
export async function payPendingStorePayouts(admin: SupabaseClient) {
  const { data: owed } = await admin.from("store_payouts")
    .select("id, store_order_id, vendor_id, kind, amount_cents").eq("status", "owed").limit(100);
  let paid = 0; const skipped: { id: string; reason: string }[] = [];
  for (const r of owed ?? []) {
    const account = await vendorStripeAccount(admin, Number(r.vendor_id));
    if (!account) { skipped.push({ id: r.id, reason: "no payout account yet" }); continue; }
    const { data: o } = await admin.from("store_orders").select("stripe_payment_intent, status").eq("id", r.store_order_id).maybeSingle();
    if (!o?.stripe_payment_intent || o.status !== "paid") { skipped.push({ id: r.id, reason: "order not payable" }); continue; }
    const chargeId = await chargeIdForPaymentIntent(o.stripe_payment_intent as string).catch(() => null);
    if (!chargeId) { skipped.push({ id: r.id, reason: "no charge" }); continue; }
    const sent = await transfer(r.store_order_id, Number(r.vendor_id), r.kind, Number(r.amount_cents), account, chargeId);
    if (!sent.ok) { skipped.push({ id: r.id, reason: sent.reason }); continue; }
    await admin.from("store_payouts").update({ status: "paid", stripe_account_id: account, stripe_transfer_id: sent.id, paid_at: new Date().toISOString(), note: null }).eq("id", r.id);
    paid++;
  }
  return { checked: owed?.length ?? 0, paid, skipped: skipped.length, skippedDetail: skipped.slice(0, 10) };
}

/** Sale undone (refund / dispute): pull paid transfers back, cancel owed ones. */
export async function reverseStorePayouts(admin: SupabaseClient, orderId: string, reason: string) {
  const { data: rows } = await admin.from("store_payouts").select("id, status, stripe_transfer_id").eq("store_order_id", orderId).in("status", ["owed", "paid"]);
  for (const r of rows ?? []) {
    let note = reason;
    if (r.status === "paid" && r.stripe_transfer_id) {
      try { await getStripe().transfers.createReversal(r.stripe_transfer_id as string, {}, { idempotencyKey: `store_payout_reverse_${r.id}` }); }
      catch (e) { note = `${reason} (reversal FAILED — recover manually: ${e instanceof Error ? e.message : String(e)})`; console.error("store payout reversal failed", r.id, e); }
    }
    await admin.from("store_payouts").update({ status: "reversed", reversed_at: new Date().toISOString(), note }).eq("id", r.id);
  }
}
