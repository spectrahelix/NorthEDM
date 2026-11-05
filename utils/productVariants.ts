/**
 * Size options for one item ("one picture per mushroom, with weight buttons",
 * owner 2026-11-05). Each size is its own `products` row — its own price,
 * stock, shipping weight, cart line and receipt name — and points at the lead
 * row of its group with `variant_of`; `variant_label` is the button text
 * ("4 oz", "3.5 g", "30 ml"). Listings show one card per group; the card and
 * the item page show a button per size with its price.
 *
 * Checkout, stock and shipping never look at groups: they see ordinary items.
 */
export const VARIANT_COLUMNS = "variant_of, variant_label";

export type Variantish = {
  id: number;
  name: string | null;
  price?: number | string | null;
  image_url?: string | null;
  variant_of?: number | null;
  variant_label?: string | null;
};

export type VariantGroup<T> = {
  key: number;
  /** The row whose photo and description stand for the group. */
  lead: T;
  /** Name without the size, e.g. "Dried Chaga". */
  title: string;
  /** Every listed size, cheapest first. One entry = an item with no sizes. */
  options: T[];
  image_url: string | null;
};

export function groupKeyOf(p: Variantish): number {
  return p.variant_of ?? p.id;
}

/** "Dried Chaga — 4 oz" → "Dried Chaga" (only when the suffix is the item's own label). */
export function baseName(p: Variantish): string {
  const name = (p.name ?? "Item").trim();
  const label = p.variant_label?.trim();
  if (!label) return name;
  for (const sep of [" — ", " – ", " - "]) {
    const tail = `${sep}${label}`;
    if (name.toLowerCase().endsWith(tail.toLowerCase())) return name.slice(0, -tail.length).trim();
  }
  return name;
}

const priceOf = (p: Variantish) => Number(p.price ?? 0);

/** One group per item, in the order the items first appear. */
export function groupVariants<T extends Variantish>(items: T[]): VariantGroup<T>[] {
  const byKey = new Map<number, T[]>();
  const order: number[] = [];
  for (const p of items) {
    const k = groupKeyOf(p);
    if (!byKey.has(k)) { byKey.set(k, []); order.push(k); }
    byKey.get(k)!.push(p);
  }
  return order.map((key) => {
    const options = [...byKey.get(key)!].sort((a, b) => priceOf(a) - priceOf(b) || a.id - b.id);
    const lead = options.find((o) => o.id === key) ?? options[0];
    const image_url = lead.image_url ?? options.find((o) => o.image_url)?.image_url ?? null;
    return { key, lead, title: baseName(lead), options, image_url };
  });
}
