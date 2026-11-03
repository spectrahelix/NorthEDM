import { storeAdminClient } from "@/utils/store";
import { publicVendorIds } from "@/utils/vendorVisibility";

/**
 * "Trending vendors": the site's own vendors ranked by real activity through
 * NorthEDM in the last `days` days — sales plus visits to their shop pages.
 * Nothing hand-typed, and no numbers are shown publicly: a vendor that clears
 * the bar is simply labelled "Hot topic" (owner's call, 2026-11-03).
 *
 * Signals:
 *   - Sales: FestDash orders that reached `delivered`, and embedded-store
 *     orders `paid`/`fulfilled` (once per vendor with a line on it).
 *     NorthEDM's own shop (`shop_orders`) is not a vendor and is left out.
 *   - Shop visits: DISTINCT visitors (`page_views.visitor_id`) to
 *     /marketplace/<id>[/…] and the vendor's storefront /<slug>[/…]
 *     (/manage excluded), not counting admins or the shop's own people
 *     (vendor account, linked profiles, store operator).
 *
 * Score = visitors + SALE_WEIGHT × sales. "Hot" = at least one sale, or at
 * least HOT_MIN_VISITORS different people looking at the shop.
 *
 * Orders and page views are private, so they're read with the service role —
 * which skips RLS, so vendor visibility is re-applied with `publicVendorIds`
 * (approved, listed, not lights-out). Only public vendor names leave this
 * function, never buyers, visitors or amounts.
 */
export type TrendingVendor = {
  id: number;
  name: string;
  category: string | null;
};

const SALE_WEIGHT = 10;
const HOT_MIN_VISITORS = 3;

export async function trendingVendors(days = 30, limit = 6): Promise<TrendingVendor[]> {
  const admin = storeAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: fd }, { data: so }, { data: links }, { data: vendorUsers }, { data: profileUsers }] =
    await Promise.all([
      admin.from("festdash_orders").select("vendor_id").eq("status", "delivered").gte("created_at", since),
      admin.from("store_orders").select("items").in("status", ["paid", "fulfilled"]).gte("created_at", since),
      admin.from("store_vendors").select("vendor_id, status, stores(slug, owner_user_id)").eq("status", "approved"),
      admin.from("vendors").select("id, user_id").not("user_id", "is", null),
      admin.from("user_profiles").select("id, vendor_id").not("vendor_id", "is", null),
    ]);

  // ── Sales ────────────────────────────────────────────────────────────────
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

  // ── Shop visits ──────────────────────────────────────────────────────────
  // Whose visits don't count for a vendor: their own people.
  const insiders = new Map<number, Set<string>>();
  const addInsider = (vid: number, uid: unknown) => {
    if (!uid) return;
    if (!insiders.has(vid)) insiders.set(vid, new Set());
    insiders.get(vid)!.add(String(uid));
  };
  for (const v of vendorUsers ?? []) addInsider(Number(v.id), v.user_id);
  for (const p of profileUsers ?? []) addInsider(Number(p.vendor_id), p.id);

  const slugToVendor = new Map<string, number>();
  for (const l of (links ?? []) as { vendor_id: number; stores: unknown }[]) {
    const st = (Array.isArray(l.stores) ? l.stores[0] : l.stores) as
      | { slug?: string | null; owner_user_id?: string | null }
      | null;
    if (!st?.slug) continue;
    slugToVendor.set(st.slug, Number(l.vendor_id));
    addInsider(Number(l.vendor_id), st.owner_user_id);
  }

  const or = [
    "path.like./marketplace/%",
    ...[...slugToVendor.keys()].flatMap((s) => [`path.eq./${s}`, `path.like./${s}/%`]),
  ].join(",");
  const { data: views } = await admin
    .from("page_views")
    .select("path, visitor_id, user_id")
    .gte("created_at", since)
    .eq("is_admin", false)
    .or(or)
    .limit(50000);

  const visitors = new Map<number, Set<string>>();
  for (const v of views ?? []) {
    const path = String(v.path);
    let vid: number | null = null;
    const m = /^\/marketplace\/(\d+)(?:\/|$)/.exec(path);
    if (m) vid = Number(m[1]);
    else {
      const [, slug, sub] = path.split("/");
      if (sub === "manage") continue;
      vid = slugToVendor.get(slug) ?? null;
    }
    if (vid == null || !v.visitor_id) continue;
    if (v.user_id && insiders.get(vid)?.has(String(v.user_id))) continue;
    if (!visitors.has(vid)) visitors.set(vid, new Set());
    visitors.get(vid)!.add(String(v.visitor_id));
  }

  // ── Rank ─────────────────────────────────────────────────────────────────
  const score = new Map<number, number>();
  for (const id of new Set([...sales.keys(), ...visitors.keys()])) {
    const s = sales.get(id) ?? 0;
    const u = visitors.get(id)?.size ?? 0;
    if (s === 0 && u < HOT_MIN_VISITORS) continue;
    score.set(id, u + SALE_WEIGHT * s);
  }
  if (score.size === 0) return [];

  const visible = await publicVendorIds([...score.keys()]);
  if (visible.size === 0) return [];
  const { data: rows } = await admin.from("vendors").select("id, name, category").in("id", [...visible]);

  return ((rows ?? []) as { id: number; name: string | null; category: string | null }[])
    .filter((v) => v.name)
    .map((v) => ({ id: Number(v.id), name: v.name as string, category: v.category, s: score.get(Number(v.id)) ?? 0 }))
    .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ id, name, category }) => ({ id, name, category }));
}
