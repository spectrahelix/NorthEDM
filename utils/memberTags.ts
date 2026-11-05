import type { SupabaseClient } from "@supabase/supabase-js";
import { grantPromoter, revokePromoter } from "@/utils/promoters";
import type { MemberTag } from "@/app/components/roleColors";

/**
 * The one way a tag is given or taken (owner, 2026-11-05: ranks and tags are
 * separate; anyone can hold any number of tags). Server-only, service role.
 *
 * - merchant → `is_marketplace` + "merchant" in `extra_ranks` (both are what
 *   `canSell()` reads). It lets them build a shop and list items; it never
 *   makes a shop public, and taking it away never touches their items.
 * - promoter → `grantPromoter` / `revokePromoter` (row + referral code), plus
 *   "promoter" in `extra_ranks`.
 * - the rest → their `is_*` flag.
 */
const FLAG: Record<Exclude<MemberTag, "merchant" | "promoter">, string> = {
  festdash_vendor: "is_festdash_vendor",
  vendor: "is_vendor",
  driver: "is_driver",
  artisan: "is_artisan",
  forager: "is_forager",
  founder: "is_founder",
};

export function isMemberTag(t: unknown): t is MemberTag {
  return t === "merchant" || t === "promoter" || (typeof t === "string" && t in FLAG);
}

async function setExtra(admin: SupabaseClient, userId: string, rank: "merchant" | "promoter", on: boolean) {
  const { data } = await admin.from("user_profiles").select("extra_ranks").eq("id", userId).maybeSingle();
  const cur = ((data?.extra_ranks as string[] | null) ?? []).filter((r) => r !== rank);
  return admin.from("user_profiles").update({ extra_ranks: on ? [...cur, rank] : cur }).eq("id", userId);
}

export async function setMemberTag(admin: SupabaseClient, userId: string, tag: MemberTag, on: boolean): Promise<{ error?: string; referral_code?: string | null }> {
  if (tag === "merchant") {
    const { error } = await admin.from("user_profiles").update({ is_marketplace: on }).eq("id", userId);
    if (error) return { error: error.message };
    const r = await setExtra(admin, userId, "merchant", on);
    return r.error ? { error: r.error.message } : {};
  }
  if (tag === "promoter") {
    let referral_code: string | null = null;
    if (on) ({ referral_code } = await grantPromoter(admin, userId));
    else await revokePromoter(admin, userId);
    const r = await setExtra(admin, userId, "promoter", on);
    return r.error ? { error: r.error.message } : { referral_code };
  }
  const { error } = await admin.from("user_profiles").update({ [FLAG[tag]]: on }).eq("id", userId);
  return error ? { error: error.message } : {};
}
