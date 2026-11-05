/**
 * Stock is optional (owner, 2026-11-05). `products.inventory_count` NULL means
 * "no limit": the item lists and sells by its sizes without a count. A number
 * means limited stock, counted down on each paid order. One place for the rule.
 */
export type Stocked = { inventory_count?: number | null };

/** Unlimited, or at least `qty` left. */
export function hasStock(p: Stocked | null | undefined, qty = 1): boolean {
  if (!p) return false;
  return p.inventory_count == null || Number(p.inventory_count) >= qty;
}

/** Supabase filter for "can be shown to customers": no limit, or some left. */
export const IN_STOCK_FILTER = "inventory_count.is.null,inventory_count.gt.0";

/** A typed stock box → the column value: blank means no limit. */
export function stockFromInput(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** New count after selling (-1) or restoring (+1); unlimited stays unlimited. */
export function adjustedCount(current: number | null | undefined, delta: number): number | null {
  if (current == null) return null;
  return Math.max(0, Number(current) + delta);
}

/** Text for owners and item pages. */
export function stockLabel(p: Stocked): string {
  return p.inventory_count == null ? "In stock" : Number(p.inventory_count) > 0 ? `${p.inventory_count} in stock` : "Out of stock";
}
