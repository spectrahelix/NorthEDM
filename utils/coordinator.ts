import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { DEFAULT_SPLITS, splitSale, type SplitSettings } from "@/utils/gambiaPay";

// Server-only helpers for the coordinator / purse-keeper model.

const ADMIN_EMAIL = "cjblue27@gmail.com";

export function serviceClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function isSiteAdminUser(admin: SupabaseClient, user: User): Promise<boolean> {
  if (user.email === ADMIN_EMAIL) return true;
  const { data } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "archon" || data?.role === "warden";
}

export async function loadSplitSettings(admin: SupabaseClient): Promise<SplitSettings> {
  const { data } = await admin
    .from("coordinator_program_settings")
    .select("sale_owner_bps, sale_coordinator_bps, delivery_extra_bps, subscription_fee_cents, subscription_coordinator_bps, bundle_fee_cents, mint_max_percent_off, mint_max_amount_off_cents")
    .eq("id", 1)
    .maybeSingle();
  return (data as SplitSettings | null) ?? DEFAULT_SPLITS;
}

/** The coordinator row (purse keeper) for a user, or null. */
export async function coordinatorFor(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("festdash_promoters")
    .select("id, user_id, display_name, is_active, is_coordinator, region, wave_number, qmoney_number, afrimoney_number, whatsapp_number, remitly_name")
    .eq("user_id", userId)
    .eq("is_coordinator", true)
    .maybeSingle();
  return data;
}

/**
 * Enrol a coordinator shop on FestDash (festdash_vendors + the profile tag).
 * Used by approval AND by assigning a coordinator to an already-approved vendor;
 * before 2026-11-02 the second path never enrolled, so the shop could pay fees
 * and still never be listed. No-op unless the vendor is approved and has a
 * coordinator. The public listing itself still waits for a current fee period.
 */
export async function enrollCoordinatorShop(admin: SupabaseClient, vendorId: number): Promise<boolean> {
  const { data: v } = await admin.from("vendors").select("id, user_id, coordinator_user_id, status").eq("id", vendorId).maybeSingle();
  if (!v?.coordinator_user_id || v.status !== "approved") return false;
  const { error } = await admin
    .from("festdash_vendors")
    .upsert({ vendor_id: v.id, user_id: v.user_id, is_active: true }, { onConflict: "vendor_id" });
  if (error) { console.error("coordinator shop enrol failed:", error.message); return false; }
  if (v.user_id) await admin.from("user_profiles").update({ is_festdash_vendor: true }).eq("id", v.user_id as string);
  return true;
}

/**
 * A promoter's own shop is treated as a shop that promoter referred (owner's
 * rule, 2026-11-03): 10% off the fee automatically, and they keep the promoter
 * share of its sales and fees — 90% to them, 10% to the owner. Returns the
 * self-referral when the vendor's account is an active promoter, else null.
 */
export async function selfReferral(admin: SupabaseClient, userId: string | null | undefined): Promise<{ user_id: string; referral_code: string | null } | null> {
  if (!userId) return null;
  const { data } = await admin.from("festdash_promoters").select("user_id, referral_code").eq("user_id", userId).eq("is_active", true).maybeSingle();
  return data ? { user_id: data.user_id as string, referral_code: (data.referral_code as string | null) ?? null } : null;
}

/** A shop's current paid period, if any (period_end on or after today). */
export async function activeSubscription(admin: SupabaseClient, vendorId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("vendor_subscriptions")
    .select("id, period_start, period_end")
    .eq("kind", "festdash")
    .eq("vendor_id", vendorId)
    .gte("period_end", today)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return data;
  // Since 2026-11-03 a wallet-rail shop may pay its fee by card instead.
  const { data: stripeRow } = await admin.from("stripe_subscriptions").select("status, current_period_end")
    .in("kind", ["festdash", "bundle"]).eq("vendor_id", vendorId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (stripeRow && ["active", "trialing"].includes(stripeRow.status) && (!stripeRow.current_period_end || new Date(stripeRow.current_period_end).getTime() + 3 * 86400000 > Date.now())) {
    return { id: "stripe", period_start: today, period_end: stripeRow.current_period_end ? String(stripeRow.current_period_end).slice(0, 10) : today };
  }
  return null;
}

/** Wallet-rail vendors among these ids that hold a current period from either source. */
export async function paidLocalVendorIds(admin: SupabaseClient, vendorIds: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  if (!vendorIds.length) return out;
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: periods }, { data: stripeRows }] = await Promise.all([
    admin.from("vendor_subscriptions").select("vendor_id").eq("kind", "festdash").in("vendor_id", vendorIds).gte("period_end", today),
    admin.from("stripe_subscriptions").select("vendor_id, status, current_period_end").in("kind", ["festdash", "bundle"]).in("vendor_id", vendorIds),
  ]);
  for (const p of periods ?? []) out.add(Number(p.vendor_id));
  for (const r of stripeRows ?? []) {
    if (["active", "trialing"].includes(r.status) && (!r.current_period_end || new Date(r.current_period_end).getTime() + 3 * 86400000 > Date.now())) out.add(Number(r.vendor_id));
  }
  return out;
}

/**
 * Book the split for a confirmed local sale. Idempotent per order: a second
 * call for the same order (a double tap, a retried webhook later) is a no-op.
 */
export async function recordSaleSplit(
  admin: SupabaseClient,
  order: { id: string; vendor_id: number; total_cents: number; runner_fee_cents?: number; /** NorthEDM's service fee — outside the split, all to the owner */ service_fee_cents?: number; /** transfer fee (Remitly cost) — also the owner's */ remit_fee_cents?: number; currency: string; payment_method: string; payment_ref: string | null; source?: "festdash" | "store"; collected_by?: "coordinator" | "owner"; /** FestDash order delivered by a runner (not pickup, not a store sale) */ delivery?: boolean },
  coordinatorUserId: string,
  settings: SplitSettings,
  createdBy: string | null
) {
  // FestDash and store orders live in different tables; each has its own
  // column (and unique index) so a store order id never lands in order_id.
  const idCol = order.source === "store" ? "store_order_id" : "order_id";
  const { data: existing } = await admin
    .from("coordinator_ledger")
    .select("id")
    .eq("kind", "sale")
    .eq(idCol, order.id)
    .maybeSingle();
  if (existing) return existing;

  // The runner's fee is the runner's and the service fee is NorthEDM's; the
  // 90/10 split is on the items only.
  const runner = Math.max(0, Math.min(Number(order.runner_fee_cents ?? 0), order.total_cents));
  const service = Math.max(0, Math.min(Number(order.service_fee_cents ?? 0) + Number(order.remit_fee_cents ?? 0), order.total_cents - runner));
  const s = splitSale(order.total_cents - runner - service, settings, true, order.delivery === true);
  const { data, error } = await admin
    .from("coordinator_ledger")
    .insert({
      kind: "sale",
      coordinator_user_id: coordinatorUserId,
      vendor_id: order.vendor_id,
      [idCol]: order.id,
      collected_by: order.collected_by ?? "coordinator",
      currency: order.currency || "USD",
      gross_cents: order.total_cents,
      shop_cents: s.shop,
      owner_cents: s.owner + service,
      coordinator_cents: s.coordinator,
      runner_cents: runner,
      method: order.payment_method,
      reference: order.payment_ref,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) console.error("coordinator ledger sale insert failed:", error.message);
  return data;
}
