import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSplitSettings, recordSaleSplit } from "@/utils/coordinator";
import { adjustStock } from "@/utils/storeSettle";
import { createPayout, PAYOUT_CHANNELS, type PayoutChannel } from "@/utils/waychit";

/**
 * What happens after Waychit says a customer paid (utils/waychit.ts):
 * the order is marked paid, the 90/10 split is booked with collected_by =
 * 'owner' (the money sits in NorthEDM's Waychit account, exactly like a card
 * on a Gambian shop), and one payout row per recipient is queued in
 * waychit_payouts. The owner sends payouts from /admin/festdash/coordinators;
 * each one that succeeds is booked as a `payout` ledger row, so "Settle net"
 * keeps working unchanged.
 */

type Kind = "festdash" | "store";

/** Payment confirmed by a verified webhook. Idempotent: only an order still awaiting payment changes. */
export async function confirmWaychitPayment(admin: SupabaseClient, kind: Kind, orderId: string, paid: { requestId: string; amountGmd: number; transactionReference: string | null }) {
  const now = new Date().toISOString();
  if (kind === "festdash") {
    const { data: o } = await admin.from("festdash_orders")
      .select("id, vendor_id, status, payment_method, total_cents, processing_fee_cents, runner_fee_cents, service_fee_cents, currency, fulfillment, waychit_request_id")
      .eq("id", orderId).maybeSingle();
    if (!o || o.payment_method !== "waychit" || o.waychit_request_id !== paid.requestId) return { ok: false, reason: "no matching order" };
    if (o.status !== "awaiting_payment") return { ok: true, reason: "already handled" };
    if (paid.amountGmd * 100 < Number(o.total_cents) + Number(o.processing_fee_cents ?? 0)) return { ok: false, reason: "amount short" };
    const { data: upd } = await admin.from("festdash_orders")
      .update({ status: "pending", payment_status: "paid_mobile", paid: true, payment_ref: paid.transactionReference, payment_confirmed_at: now, updated_at: now })
      .eq("id", orderId).eq("status", "awaiting_payment").select("id").maybeSingle();
    if (!upd) return { ok: true, reason: "already handled" };
    const { data: v } = await admin.from("vendors").select("id, coordinator_user_id").eq("id", o.vendor_id).maybeSingle();
    if (!v?.coordinator_user_id) return { ok: true, reason: "paid; no coordinator to book" };
    const settings = await loadSplitSettings(admin);
    const row = await recordSaleSplit(admin, {
      id: o.id, vendor_id: Number(o.vendor_id), total_cents: Number(o.total_cents), runner_fee_cents: Number(o.runner_fee_cents ?? 0), service_fee_cents: Number(o.service_fee_cents ?? 0),
      currency: String(o.currency || "GMD"), payment_method: "waychit", payment_ref: paid.transactionReference, collected_by: "owner", delivery: o.fulfillment !== "pickup",
    }, v.coordinator_user_id as string, settings, null);
    await queueSalePayouts(admin, kind, o.id, row?.id ?? null);
    return { ok: true, reason: "paid" };
  }

  const { data: o } = await admin.from("store_orders")
    .select("id, vendor_id, status, payment_method, items, subtotal_cents, total_cents, processing_fee_cents, currency, waychit_request_id")
    .eq("id", orderId).maybeSingle();
  if (!o || o.payment_method !== "waychit" || o.waychit_request_id !== paid.requestId) return { ok: false, reason: "no matching order" };
  if (o.status !== "awaiting_payment") return { ok: true, reason: "already handled" };
  if (paid.amountGmd * 100 < Number(o.total_cents) + Number(o.processing_fee_cents ?? 0)) return { ok: false, reason: "amount short" };
  const { data: upd } = await admin.from("store_orders")
    .update({ status: "paid", paid_at: now, payment_ref: paid.transactionReference, payment_confirmed_at: now, updated_at: now })
    .eq("id", orderId).eq("status", "awaiting_payment").select("id").maybeSingle();
  if (!upd) return { ok: true, reason: "already handled" };
  await adjustStock(admin, (o.items ?? []) as { product_id: number; qty: number }[], -1);
  const { data: v } = o.vendor_id ? await admin.from("vendors").select("id, coordinator_user_id").eq("id", o.vendor_id).maybeSingle() : { data: null };
  if (!v?.coordinator_user_id) return { ok: true, reason: "paid; no coordinator to book" };
  const settings = await loadSplitSettings(admin);
  const row = await recordSaleSplit(admin, {
    id: o.id, vendor_id: Number(o.vendor_id), total_cents: Number(o.subtotal_cents ?? o.total_cents), runner_fee_cents: 0,
    currency: String(o.currency || "GMD"), payment_method: "waychit", payment_ref: paid.transactionReference, source: "store", collected_by: "owner",
  }, v.coordinator_user_id as string, settings, null);
  await queueSalePayouts(admin, kind, o.id, row?.id ?? null);
  return { ok: true, reason: "paid" };
}

type Wallets = { wave?: string | null; qmoney?: string | null; afrimoney?: string | null; preferred?: string | null } | null;
function pickWallet(w: Wallets): { channel: PayoutChannel | null; destination: string | null } {
  if (!w) return { channel: null, destination: null };
  const pref = (w.preferred ?? "").toLowerCase();
  const order = [pref, "wave", "qmoney", "afrimoney"].filter((c) => (PAYOUT_CHANNELS as readonly string[]).includes(c)) as PayoutChannel[];
  for (const c of order) { const n = (w as Record<string, string | null | undefined>)[c]; if (n) return { channel: c, destination: n }; }
  return { channel: null, destination: null };
}

/** One payout row each for the shop and the coordinator, from the sale's ledger row. Safe to call twice. */
export async function queueSalePayouts(admin: SupabaseClient, kind: Kind, orderId: string, ledgerId: string | null) {
  if (!ledgerId) return;
  const { data: l } = await admin.from("coordinator_ledger").select("id, vendor_id, coordinator_user_id, shop_cents, coordinator_cents").eq("id", ledgerId).maybeSingle();
  if (!l) return;
  const [{ data: shop }, { data: coord }] = await Promise.all([
    admin.from("vendors").select("id, payout_wallets").eq("id", l.vendor_id).maybeSingle(),
    admin.from("festdash_promoters").select("user_id, wave_number, qmoney_number, afrimoney_number").eq("user_id", l.coordinator_user_id).maybeSingle(),
  ]);
  const s = pickWallet((shop?.payout_wallets ?? null) as Wallets);
  const c = pickWallet(coord ? { wave: coord.wave_number, qmoney: coord.qmoney_number, afrimoney: coord.afrimoney_number } : null);
  const rows = [
    { role: "shop", amount: Number(l.shop_cents), vendor_id: l.vendor_id, user_id: null, ...s },
    { role: "coordinator", amount: Number(l.coordinator_cents), vendor_id: l.vendor_id, user_id: l.coordinator_user_id, ...c },
  ].filter((r) => r.amount >= 100).map((r) => ({
    ledger_id: l.id, order_kind: kind, order_id: orderId, role: r.role, vendor_id: r.vendor_id, user_id: r.user_id,
    coordinator_user_id: l.coordinator_user_id, channel: r.channel, destination: r.destination,
    amount_gmd: Math.floor(r.amount / 100), idempotency_key: `${kind}:${orderId}:${r.role}`,
  }));
  if (rows.length) await admin.from("waychit_payouts").upsert(rows, { onConflict: "order_kind,order_id,role", ignoreDuplicates: true });
}

/** A delivered Waychit FestDash order owes its runner the runner fee (runner known only at delivery). */
export async function queueRunnerPayout(admin: SupabaseClient, orderId: string) {
  const { data: o } = await admin.from("festdash_orders").select("id, vendor_id, driver_id, runner_fee_cents, payment_method").eq("id", orderId).maybeSingle();
  if (!o || o.payment_method !== "waychit" || !o.driver_id || Number(o.runner_fee_cents ?? 0) < 100) return;
  const { data: d } = await admin.from("festdash_drivers").select("user_id, phone").eq("user_id", o.driver_id).maybeSingle();
  const { data: v } = await admin.from("vendors").select("coordinator_user_id").eq("id", o.vendor_id).maybeSingle();
  const { data: l } = await admin.from("coordinator_ledger").select("id").eq("kind", "sale").eq("order_id", orderId).maybeSingle();
  await admin.from("waychit_payouts").upsert([{
    ledger_id: l?.id ?? null, order_kind: "festdash", order_id: orderId, role: "runner", vendor_id: o.vendor_id, user_id: d?.user_id ?? null,
    coordinator_user_id: v?.coordinator_user_id ?? null,
    // The runner's phone is a guess at their Wave number; the owner checks it before sending.
    channel: d?.phone ? "wave" : null, destination: d?.phone ?? null,
    amount_gmd: Math.floor(Number(o.runner_fee_cents) / 100), idempotency_key: `festdash:${orderId}:runner`,
  }], { onConflict: "order_kind,order_id,role", ignoreDuplicates: true });
}

/** Owner presses Send. Claims the row, calls Waychit Payouts, records the answer. */
export async function sendWaychitPayout(admin: SupabaseClient, payoutId: string, by: string) {
  const { data: p } = await admin.from("waychit_payouts").select("*").eq("id", payoutId).maybeSingle();
  if (!p) return { error: "Payout not found." };
  if (!["owed", "failed"].includes(p.status)) return { error: `This payout is ${p.status}.` };
  if (!p.channel || !p.destination) return { error: "Set where to send it first." };
  if (Number(p.amount_gmd) < 1) return { error: "Nothing to send." };
  const attempt = Number(p.attempts ?? 0) + 1;
  const { data: claimed } = await admin.from("waychit_payouts")
    .update({ status: "sending", attempts: attempt, sent_by: by, error: null, updated_at: new Date().toISOString() })
    .eq("id", p.id).eq("status", p.status).select("id").maybeSingle();
  if (!claimed) return { error: "Someone else is sending this one." };
  const ref = `${p.id}-${attempt}`;
  try {
    const out = await createPayout({
      channel: p.channel, amountGmd: Number(p.amount_gmd), destination: p.destination, clientReference: ref,
      reason: `NorthEDM ${p.role} share`, idempotencyKey: ref,
    });
    const status = ["pending", "processing", "succeeded", "failed", "reversed"].includes(out.status) ? out.status : "pending";
    await admin.from("waychit_payouts").update({ status, waychit_payout_id: out.id, fee_gmd: out.fee ?? null, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", p.id);
    if (status === "succeeded") await bookPayout(admin, p.id);
    return { ok: true, status };
  } catch (e) {
    // Outcome unknown on a network error — park it as pending so it can't be
    // sent twice; the payout webhook (or Waychit's dashboard) settles it.
    const msg = e instanceof Error ? e.message : String(e);
    const definite = /^Waychit 4\d\d/.test(msg);
    await admin.from("waychit_payouts").update({ status: definite ? "failed" : "pending", error: msg.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", p.id);
    return { error: msg };
  }
}

/** A succeeded payout reduces what the owner owes that coordinator's book (idempotent per payout). */
export async function bookPayout(admin: SupabaseClient, payoutId: string, reversal = false) {
  const { data: p } = await admin.from("waychit_payouts").select("id, role, coordinator_user_id, amount_gmd, waychit_payout_id, order_id").eq("id", payoutId).maybeSingle();
  if (!p?.coordinator_user_id || !p.waychit_payout_id) return;
  const reference = `${reversal ? "reversed:" : ""}waychit:${p.waychit_payout_id}`;
  const { data: exists } = await admin.from("coordinator_ledger").select("id").eq("kind", "payout").eq("reference", reference).maybeSingle();
  if (exists) return;
  await admin.from("coordinator_ledger").insert({
    kind: "payout", coordinator_user_id: p.coordinator_user_id, collected_by: "owner", currency: "GMD",
    gross_cents: (reversal ? -1 : 1) * Number(p.amount_gmd) * 100, method: "waychit", reference,
    note: `${reversal ? "Reversed: " : ""}Waychit payout to ${p.role} for order ${String(p.order_id).slice(0, 8)}`,
  });
}

/** payout.succeeded / payout.failed / payout.reversed from the webhook. */
export async function applyPayoutEvent(admin: SupabaseClient, type: string, payoutWaychitId: string) {
  const { data: p } = await admin.from("waychit_payouts").select("id, status").eq("waychit_payout_id", payoutWaychitId).maybeSingle();
  if (!p) return;
  const status = type === "payout.succeeded" ? "succeeded" : type === "payout.failed" ? "failed" : type === "payout.reversed" ? "reversed" : null;
  if (!status || p.status === status) return;
  await admin.from("waychit_payouts").update({ status, updated_at: new Date().toISOString() }).eq("id", p.id);
  if (status === "succeeded") await bookPayout(admin, p.id);
  if (status === "reversed" && p.status === "succeeded") await bookPayout(admin, p.id, true);
}
