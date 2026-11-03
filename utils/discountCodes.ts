import type { SupabaseClient } from "@supabase/supabase-js";
import { makeReferralCode } from "@/utils/promoters";

/**
 * Codes a shop can type at a subscription checkout (or on its application).
 * Two kinds resolve here:
 *   referral — a promoter's permanent referral code: referral_fee_discount_bps
 *              off every month, and the promoter is attributed.
 *   discount — a row in discount_codes: % or $ off; one-time codes apply to
 *              the first invoice only and are spent on use, unlimited codes
 *              apply every month. A code minted by a promoter also attributes
 *              that promoter.
 */
export type ResolvedCode =
  | { kind: "referral"; code: string; promoter_user_id: string; percent_off: number }
  | { kind: "discount"; code: string; id: string; percent_off: number | null; amount_off_cents: number | null; once: boolean; promoter_user_id: string | null };

export async function resolveCode(admin: SupabaseClient, raw: string | null | undefined, referralBps: number): Promise<ResolvedCode | null> {
  const code = String(raw ?? "").trim().toUpperCase().slice(0, 40);
  if (!code) return null;
  const { data: p } = await admin.from("festdash_promoters").select("user_id, referral_code").ilike("referral_code", code).eq("is_active", true).maybeSingle();
  if (p?.user_id) return { kind: "referral", code: p.referral_code as string, promoter_user_id: p.user_id as string, percent_off: referralBps / 100 };
  const { data: d } = await admin.from("discount_codes")
    .select("id, code, percent_off, amount_off_cents, max_redemptions, times_redeemed, active, expires_at, minted_by")
    .ilike("code", code).maybeSingle();
  if (!d || !d.active) return null;
  if (d.expires_at && new Date(d.expires_at) < new Date()) return null;
  if (d.max_redemptions != null && Number(d.times_redeemed) >= Number(d.max_redemptions)) return null;
  return {
    kind: "discount", code: d.code as string, id: d.id as string,
    percent_off: d.percent_off != null ? Number(d.percent_off) : null,
    amount_off_cents: d.amount_off_cents != null ? Number(d.amount_off_cents) : null,
    once: d.max_redemptions === 1, promoter_user_id: (d.minted_by as string | null) ?? null,
  };
}

export function applyCode(listCents: number, c: ResolvedCode | null): number {
  if (!c) return listCents;
  if (c.kind === "referral") return Math.max(0, Math.round(listCents * (1 - c.percent_off / 100)));
  if (c.percent_off != null) return Math.max(0, Math.round(listCents * (1 - c.percent_off / 100)));
  return Math.max(0, listCents - (c.amount_off_cents ?? 0));
}

export function describeCode(c: ResolvedCode): string {
  if (c.kind === "referral") return `${c.percent_off}% off every month (referral)`;
  const amt = c.percent_off != null ? `${c.percent_off}% off` : `$${((c.amount_off_cents ?? 0) / 100).toFixed(2)} off`;
  return c.once ? `${amt} your first month` : `${amt} every month`;
}

/** Spend one redemption (optimistic lock). Safe to call again for the same checkout: the webhook passes the session id. */
export async function redeemCode(admin: SupabaseClient, codeId: string, userId: string | null) {
  const { data: d } = await admin.from("discount_codes").select("times_redeemed, max_redemptions").eq("id", codeId).maybeSingle();
  if (!d) return false;
  if (d.max_redemptions != null && Number(d.times_redeemed) >= Number(d.max_redemptions)) return false;
  const { data: upd } = await admin.from("discount_codes")
    .update({ times_redeemed: Number(d.times_redeemed) + 1, last_redeemed_by: userId, last_redeemed_at: new Date().toISOString() })
    .eq("id", codeId).eq("times_redeemed", d.times_redeemed).select("id").maybeSingle();
  return !!upd;
}

/** A promoter-minted one-time code: PROMOTERCODE-XXXX. */
export function mintedCodeFor(referralCode: string | null): string {
  return `${(referralCode ?? "NE").toUpperCase()}-${makeReferralCode().slice(0, 4)}`;
}
