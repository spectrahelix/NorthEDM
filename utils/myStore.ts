import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The storefront a signed-in person "owns": the store they operate, or else
 * the store their vendor sells in. Lets /shop send Kody, Frank or Gee to
 * /franks or /Gees instead of NorthEDM's own shop. Service-role read: a
 * draft store isn't visible to an ordinary session, and its operator should
 * still land on it.
 */
export async function myStoreSlug(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: own } = await admin.from("stores").select("slug").eq("owner_user_id", userId).order("active", { ascending: false }).limit(1).maybeSingle();
  if (own?.slug) return own.slug as string;
  const [{ data: prof }, { data: vend }] = await Promise.all([
    admin.from("user_profiles").select("vendor_id").eq("id", userId).maybeSingle(),
    admin.from("vendors").select("id").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  const vendorIds = [prof?.vendor_id, vend?.id].filter((v) => v != null).map(Number);
  if (!vendorIds.length) return null;
  const { data: sv } = await admin.from("store_vendors").select("stores(slug, active)").in("vendor_id", vendorIds).eq("status", "approved");
  type Row = { stores: { slug: string; active: boolean } | { slug: string; active: boolean }[] | null };
  const list = ((sv ?? []) as Row[]).flatMap((r) => (Array.isArray(r.stores) ? r.stores : r.stores ? [r.stores] : []));
  return (list.find((s) => s.active) ?? list[0])?.slug ?? null;
}
