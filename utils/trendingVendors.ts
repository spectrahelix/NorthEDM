import { storeAdminClient } from "@/utils/store";
import { publicVendorIds } from "@/utils/vendorVisibility";

/**
 * "Trending vendors" = the site's own vendors ranked by completed sales made
 * through NorthEDM in the last `days` days. Nothing else: no hand-typed
 * vendors, no growth percentages.
 *
 * Counted as a sale:
 *   - a FestDash order that reached `delivered` (money released), and
 *   - an embedded-store order that is `paid` or `fulfilled`, once per vendor
 *     with at least one line on it (authorised holds don't count yet).
 * NorthEDM's own shop (`shop_orders`) is not a vendor and is left out.
 *
 * Orders are private, so they're read with the service role — which skips
 * RLS, so vendor visibility is re-applied here with `publicVendorIds`
 * (approved, listed, not lights-out). Only counts and public vendor names
 * leave this function; never buyers, amounts or order lines.
 */
export type TrendingVendor = {
  id: number;
  name: string;
  category: string | null;
  sales: number;
};

export async function trendingVendors(days = 30, limit = 6): Promise<TrendingVendor[]> {
  const admin = storeAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: fd }, { data: so }] = await Promise.all([
    admin
      .from("festdash_orders")
      .select("vendor_id")
      .eq("status", "delivered")
      .gte("created_at", since),
    admin
      .from("store_orders")
      .select("items")
      .in("status", ["paid", "fulfilled"])
      .gte("created_at", since),
  ]);

  const sales = new Map<number, number>();
  const bump = (id: number) => sales.set(id, (sales.get(id) ?? 0) + 1);
  for (const o of fd ?? []) if (o.vendor_id != null) bump(Number(o.vendor_id));
  for (const o of so ?? []) {
    const ids = new Set(
      ((o.items ?? []) as { vendor_id?: number | null }[])
        .map((l) => Number(l.vendor_id))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
    ids.forEach(bump);
  }
  if (sales.size === 0) return [];

  const visible = await publicVendorIds([...sales.keys()]);
  if (visible.size === 0) return [];
  const { data: rows } = await admin
    .from("vendors")
    .select("id, name, category")
    .in("id", [...visible]);

  return ((rows ?? []) as { id: number; name: string | null; category: string | null }[])
    .filter((v) => v.name)
    .map((v) => ({ id: Number(v.id), name: v.name as string, category: v.category, sales: sales.get(Number(v.id)) ?? 0 }))
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name))
    .slice(0, limit);
}
