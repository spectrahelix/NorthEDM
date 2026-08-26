import { createClient as createAdminClient } from "@supabase/supabase-js";

// Resolving a promoter's permanent referral code, server-side only.
//
// A promoter's code lives on festdash_promoters.referral_code and is reusable
// forever (post it, print the QR, text it). Using it on a paid action gives the
// customer DISCOUNT_BPS off and earns the promoter COMMISSION_BPS of the LIST
// price in cash — so on a $100 sale the customer pays $90, the promoter gets $10,
// and NorthEDM nets $80. See docs/WALLET.md.

export const DISCOUNT_BPS = 1000;   // 10% off for the customer
export const COMMISSION_BPS = 1000; // 10% of list, cash to the promoter

export function discountCents(listCents: number, bps = DISCOUNT_BPS): number {
  return Math.floor((listCents * bps) / 10000);
}

export function commissionCents(listCents: number, bps = COMMISSION_BPS): number {
  return Math.floor((listCents * bps) / 10000);
}

export function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type ResolvedPromoter = { userId: string; code: string; displayName: string | null };

/**
 * Look up an ACTIVE promoter by referral code. Returns null for unknown or
 * inactive codes — callers must treat null as "no discount", never as an error
 * that blocks payment.
 */
export async function resolvePromoterCode(rawCode: string): Promise<ResolvedPromoter | null> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code || code.length < 4 || code.length > 24) return null;

  const admin = adminClient();
  const { data } = await admin
    .from("festdash_promoters")
    .select("user_id, referral_code, display_name, is_active")
    .eq("referral_code", code)
    .maybeSingle();

  if (!data || !data.is_active || !data.user_id) return null;
  return { userId: data.user_id as string, code, displayName: (data.display_name as string) ?? null };
}
