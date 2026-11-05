import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * NorthEDM's main brand shop (owner's decisions, 2026-11-05): the marketplace
 * vendor "NorthEDM" (vendor 37), run from the owner's archon account, selling
 * through its own embedded store `/northedm` like every other shop — items on
 * /vendor/dashboard, look and orders on /northedm/manage. `/shop` sends
 * everyone here (a shop owner's own /shop still goes to their store). Its
 * sales are NorthEDM's own money: no vendor payouts are made from them.
 *
 * Discounts here (owner's rules, 2026-11-05), one code box at checkout:
 *  - a promoter's code: the buyer saves `brand_code_discount_bps` (5%) of the
 *    items, and that promoter earns `brand_code_commission_bps` (5%) of the
 *    discounted items — booked only if their payout account is connected when
 *    the order is paid, then paid by the commissions cron (Stripe Connect);
 *  - a promoter buying for themselves ALWAYS gets the 5%, no code needed, and
 *    no commission (nobody earns on their own order);
 *  - a discount coupon (`discount_codes`: vouchers, minted codes) STACKS on top
 *    of the promoter 5%: percent coupons apply to the items after the 5%.
 *    Stripe Checkout takes one coupon, so the total is sent as one amount-off.
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

/** Is this user an active promoter (they get the 5% on their own orders)? */
export async function isActivePromoter(admin: SupabaseClient, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await admin.from("festdash_promoters").select("user_id").eq("user_id", userId).eq("is_active", true).maybeSingle();
  return !!data;
}

/** The stacked brand-shop discount on `subtotalCents`. */
export function brandDiscount(subtotalCents: number, promoterBps: number, voucher: { percent_off: number | null; amount_off_cents: number | null } | null) {
  const promoterCents = Math.round((subtotalCents * promoterBps) / 10000);
  const afterPromoter = subtotalCents - promoterCents;
  const voucherCents = !voucher ? 0
    : voucher.percent_off != null ? Math.round((afterPromoter * voucher.percent_off) / 100)
    : Math.min(afterPromoter, Math.max(0, voucher.amount_off_cents ?? 0));
  return { promoterCents, voucherCents, totalCents: Math.min(subtotalCents, promoterCents + voucherCents) };
}
