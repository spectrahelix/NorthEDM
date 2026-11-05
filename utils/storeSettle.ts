import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe";
import { isLocalRail } from "@/utils/gambiaPay";
import { loadSplitSettings, recordSaleSplit } from "@/utils/coordinator";
import { chargeIdForPaymentIntent, payStoreOrder } from "@/utils/storePayouts";
import { recordCommission, commissionTerms } from "@/utils/commissions";
import { BRAND_SHOP_VENDOR_ID, brandCodeTerms } from "@/utils/brandShop";
import { redeemCode } from "@/utils/discountCodes";

/**
 * Everything that happens once a store order's money is final: the vendor
 * payouts or the owner-collected ledger split, and the promoter commission.
 * Called by the webhook when a card is captured at purchase (US stores) and
 * by the handover route when a held card is captured (Gambian stores).
 * Idempotent through the ledger / payouts / commissions tables' own guards.
 */
export async function settleStoreOrder(db: SupabaseClient, orderId: string) {
  const { data: order } = await db.from("store_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "paid") return;
  const { data: st } = await db.from("stores").select("owner_user_id").eq("id", order.store_id).maybeSingle();
  if (!st?.owner_user_id) return;
  const { data: op } = await db.from("user_profiles").select("vendor_id").eq("id", st.owner_user_id).maybeSingle();
  const { data: vend } = op?.vendor_id ? await db.from("vendors").select("id, coordinator_user_id, currency").eq("id", op.vendor_id).maybeSingle() : { data: null };
  const promoter = (vend?.coordinator_user_id as string | null) ?? null;
  const pi = (order.stripe_payment_intent as string | null) ?? null;

  if (vend && isLocalRail(vend) && promoter) {
    // Gambian shop's store: the money is with NorthEDM; shop + coordinator
    // shares are owed BY the owner and sent to the coordinator to disburse.
    const settings = await loadSplitSettings(db);
    await recordSaleSplit(db, {
      id: String(order.id), vendor_id: Number(vend.id), total_cents: Number(order.subtotal_cents ?? order.total_cents), runner_fee_cents: 0,
      currency: String(order.currency || vend.currency || "USD"), payment_method: "card", payment_ref: pi,
      source: "store", collected_by: "owner",
    }, promoter, settings, null);
    return;
  }
  // The NorthEDM brand shop's sales are NorthEDM's own money: no vendor
  // payouts. A promoter code used there earns its promoter the brand-code
  // commission — only if their payout account is connected (owner's rule).
  if (vend && Number(vend.id) === BRAND_SHOP_VENDOR_ID) {
    // A discount coupon used here is spent once the order is paid.
    if (order.voucher_code_id) await redeemCode(db, String(order.voucher_code_id), (order.customer_id as string | null) ?? null);
    const promoterId = (order.promoter_user_id as string | null) ?? null;
    if (promoterId) {
      const { data: pr } = await db.from("festdash_promoters").select("stripe_account_id, is_active").eq("user_id", promoterId).maybeSingle();
      if (pr?.stripe_account_id && pr.is_active) {
        const terms = await brandCodeTerms(db);
        const { holdDays } = await commissionTerms(db, "store_order");
        await recordCommission(db, {
          promoterUserId: promoterId, referredUserId: (order.customer_id as string | null) ?? null, source: "store_order", sourceId: String(order.id),
          baseCents: Math.max(0, Number(order.subtotal_cents ?? 0) - Number(order.discount_cents ?? 0)), rateBps: terms.commissionBps, holdDays,
        });
      }
    }
    return;
  }
  // US store: pay each selling vendor from this charge (owed if not connected yet).
  const chargeId = pi ? await chargeIdForPaymentIntent(pi).catch(() => null) : null;
  await payStoreOrder(db, String(order.id), chargeId);
  if (promoter && promoter !== st.owner_user_id) {
    const { data: prof } = await db.from("user_profiles").select("role").eq("id", promoter).maybeSingle();
    if (prof?.role !== "archon") {
      const { data: split } = await db.from("coordinator_program_settings").select("sale_coordinator_bps").eq("id", 1).maybeSingle();
      const { holdDays } = await commissionTerms(db, "store_order");
      await recordCommission(db, {
        promoterUserId: promoter, referredUserId: st.owner_user_id, source: "store_order", sourceId: String(order.id),
        baseCents: Number(order.subtotal_cents ?? 0), rateBps: split?.sale_coordinator_bps ?? 1000, holdDays,
      });
    }
  }
}

type Line = { product_id: number; qty: number };
export async function adjustStock(db: SupabaseClient, items: Line[], direction: -1 | 1) {
  for (const it of items ?? []) {
    const { data: p } = await db.from("products").select("inventory_count").eq("id", it.product_id).maybeSingle();
    if (p) await db.from("products").update({ inventory_count: Math.max(0, (p.inventory_count ?? 0) + direction * Number(it.qty)) }).eq("id", it.product_id);
  }
}

/** Release a held card and put the stock back. Safe to call on any status; only an authorized order changes. */
export async function cancelStoreHold(db: SupabaseClient, orderId: string, reason: string) {
  const { data: order } = await db.from("store_orders").select("id, status, stripe_payment_intent, items").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "authorized") return false;
  if (order.stripe_payment_intent) {
    try { await getStripe().paymentIntents.cancel(order.stripe_payment_intent as string); }
    catch (e) { console.error(`store hold cancel failed for ${orderId}:`, e instanceof Error ? e.message : e); }
  }
  const { data: upd } = await db.from("store_orders").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", orderId).eq("status", "authorized").select("id").maybeSingle();
  if (upd) await adjustStock(db, (order.items ?? []) as Line[], 1);
  console.log(`store hold released for ${orderId}: ${reason}`);
  return !!upd;
}

/** Holds Stripe will drop at 7 days are released by us at 6, so stock comes back and the customer is not left guessing. */
export async function expireStoreHolds(db: SupabaseClient) {
  const cutoff = new Date(Date.now() - 6 * 86400000).toISOString();
  const { data: stale } = await db.from("store_orders").select("id").eq("status", "authorized").lt("authorized_at", cutoff).limit(50);
  let released = 0;
  for (const o of stale ?? []) if (await cancelStoreHold(db, o.id as string, "hold expired unfulfilled")) released++;
  return { checked: stale?.length ?? 0, released };
}
