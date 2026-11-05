import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * NorthEDM's main brand shop (owner's decisions, 2026-11-05): the marketplace
 * vendor "NorthEDM" (vendor 37), run from the owner's archon account, selling
 * through its own embedded store `/northedm` like every other shop — items on
 * /vendor/dashboard, look and orders on /northedm/manage. `/shop` sends
 * everyone here (a shop owner's own /shop still goes to their store). Its
 * sales are NorthEDM's own money: no vendor payouts are made from them.
 *
 * Promoter codes work only here: the buyer saves `brand_code_discount_bps`
 * (5%) of the items, and the code's promoter earns `brand_code_commission_bps`
 * (5%) of the discounted items — booked only if their payout account is
 * connected when the order is paid (owner's rule), then paid by the
 * commissions cron through Stripe Connect like every other commission.
 */
export const BRAND_SHOP_VENDOR_ID = 37;
export const BRAND_STORE_SLUG = "northedm";
export const BRAND_SHOP_PATH = `/${BRAND_STORE_SLUG}`;

export type BrandCodeTerms = { discountBps: number; commissionBps: number };
export async function brandCodeTerms(admin: SupabaseClient): Promise<BrandCodeTerms> {
  const { data } = await admin.from("coordinator_program_settings").select("brand_code_discount_bps, brand_code_commission_bps").eq("id", 1).maybeSingle();
  return { discountBps: Number(data?.brand_code_discount_bps ?? 500), commissionBps: Number(data?.brand_code_commission_bps ?? 500) };
}

/** An active promoter's referral code → their user id (case-insensitive). */
export async function promoterForCode(admin: SupabaseClient, raw: unknown): Promise<{ userId: string; code: string } | null> {
  const code = String(raw ?? "").trim();
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) return null;
  const { data } = await admin.from("festdash_promoters").select("user_id, referral_code").ilike("referral_code", code).eq("is_active", true).maybeSingle();
  return data?.user_id ? { userId: data.user_id as string, code: data.referral_code as string } : null;
}
