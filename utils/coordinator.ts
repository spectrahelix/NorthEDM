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
    .select("sale_owner_bps, sale_coordinator_bps, subscription_fee_cents, subscription_coordinator_bps")
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
  return data;
}

/**
 * Book the split for a confirmed local sale. Idempotent per order: a second
 * call for the same order (a double tap, a retried webhook later) is a no-op.
 */
export async function recordSaleSplit(
  admin: SupabaseClient,
  order: { id: string; vendor_id: number; total_cents: number; runner_fee_cents?: number; currency: string; payment_method: string; payment_ref: string | null },
  coordinatorUserId: string,
  settings: SplitSettings,
  createdBy: string
) {
  const { data: existing } = await admin
    .from("coordinator_ledger")
    .select("id")
    .eq("kind", "sale")
    .eq("order_id", order.id)
    .maybeSingle();
  if (existing) return existing;

  // The runner's fee is the runner's; the 80/10/10 is on the items only.
  const runner = Math.max(0, Math.min(Number(order.runner_fee_cents ?? 0), order.total_cents));
  const s = splitSale(order.total_cents - runner, settings);
  const { data, error } = await admin
    .from("coordinator_ledger")
    .insert({
      kind: "sale",
      coordinator_user_id: coordinatorUserId,
      vendor_id: order.vendor_id,
      order_id: order.id,
      currency: order.currency || "USD",
      gross_cents: order.total_cents,
      shop_cents: s.shop,
      owner_cents: s.owner,
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
