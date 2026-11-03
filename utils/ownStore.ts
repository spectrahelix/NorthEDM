import type { SupabaseClient } from "@supabase/supabase-js";
import { RESERVED_SLUGS } from "@/utils/store";

/** The store this user operates, or a new draft one under the vendor's name (bundle purchases, "get a store"). */
export async function ensureOwnStore(admin: SupabaseClient, userId: string, vendorId: number, vendorName: string) {
  const { data: existing } = await admin.from("stores").select("id, slug").eq("owner_user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (existing) return existing as { id: string; slug: string };
  const base = vendorName.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `shop-${vendorId}`;
  let slug = RESERVED_SLUGS.has(base) ? `${base}-shop` : base;
  for (let i = 2; i < 50; i++) {
    const { data: taken } = await admin.from("stores").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }
  const { data: created, error } = await admin.from("stores")
    .insert({ slug, name: vendorName, owner_user_id: userId, active: true, billing_status: "unpaid", operator_fee_bps: 0 })
    .select("id, slug").single();
  if (error || !created) throw new Error(error?.message ?? "Couldn't create your store.");
  await admin.from("store_vendors").upsert({ store_id: created.id, vendor_id: vendorId }, { onConflict: "store_id,vendor_id", ignoreDuplicates: true });
  return created as { id: string; slug: string };
}
