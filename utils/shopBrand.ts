import { cookies } from "next/headers";
import { storeAdminClient } from "@/utils/store";
import { storeTheme, type StoreTheme } from "@/utils/storeThemes";
import { SHOP_FONTS_COOKIE } from "@/utils/storeFonts";
import { shopFontFamily } from "@/app/fonts/shopFonts";
import { accentOr } from "@/utils/accent";

/**
 * How a shop looks to the person viewing it right now.
 *
 * The font is shown only when all three agree: the shop HAS a font, its
 * operator allows it (stores.allow_custom_font), and this visitor hasn't
 * switched shop fonts off (ne_shop_fonts cookie). Any "no" → standard font.
 */
export type ShopBrand = {
  theme: StoreTheme;
  accent: string;
  /** CSS font-family for names/headings/prices, or null for the standard font. */
  font: string | null;
  /** The shop has a font this viewer could switch on/off — show the toggle. */
  hasFont: boolean;
};

type StoreBrandRow = {
  theme: string | null; font: string | null; accent_color: string | null;
  allow_custom_font: boolean | null; allow_custom_theme?: boolean | null;
};

export async function viewerWantsShopFonts(): Promise<boolean> {
  return (await cookies()).get(SHOP_FONTS_COOKIE)?.value !== "off";
}

export function brandFor(store: StoreBrandRow | null, viewerOn: boolean, fallbackAccent?: string | null): ShopBrand {
  // The operator's Custom/Standard theme switch: Standard → NorthEDM backdrop,
  // with their chosen theme kept for when they switch back.
  const theme = storeTheme(store?.allow_custom_theme === false ? "northedm" : store?.theme);
  const family = store?.allow_custom_font !== false ? shopFontFamily(store?.font) : null;
  return {
    theme,
    accent: theme.accent ?? accentOr(store?.accent_color ?? fallbackAccent),
    font: viewerOn ? family : null,
    hasFont: !!family,
  };
}

/**
 * Brands for vendors, from the store each one belongs to — preferring the
 * store their own account operates (their "embedded site") over any shared
 * store they also sell in. Vendors with no store get the NorthEDM default.
 * Read with the service role: theme/font are presentation, not private data.
 */
export async function brandsForVendors(
  vendors: { id: number; user_id?: string | null; accent_color?: string | null }[],
): Promise<Map<number, ShopBrand>> {
  const viewerOn = await viewerWantsShopFonts();
  const out = new Map<number, ShopBrand>();
  if (!vendors.length) return out;
  const { data } = await storeAdminClient()
    .from("store_vendors")
    .select("vendor_id, stores(theme, font, allow_custom_font, allow_custom_theme, accent_color, owner_user_id)")
    .in("vendor_id", vendors.map((v) => v.id))
    .eq("status", "approved");
  type Row = { vendor_id: number; stores: (StoreBrandRow & { owner_user_id: string }) | (StoreBrandRow & { owner_user_id: string })[] | null };
  const byVendor = new Map<number, (StoreBrandRow & { owner_user_id: string })[]>();
  for (const r of (data ?? []) as Row[]) {
    const s = Array.isArray(r.stores) ? r.stores : r.stores ? [r.stores] : [];
    byVendor.set(r.vendor_id, [...(byVendor.get(r.vendor_id) ?? []), ...s]);
  }
  for (const v of vendors) {
    const stores = byVendor.get(v.id) ?? [];
    const own = stores.find((s) => v.user_id && s.owner_user_id === v.user_id) ?? stores[0] ?? null;
    out.set(v.id, brandFor(own, viewerOn, v.accent_color));
  }
  return out;
}
