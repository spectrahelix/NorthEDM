/**
 * The curated display fonts a shop can be given. The NorthEDM owner picks one
 * with the vendor when setting their site up (/admin/stores), so every option
 * here has been chosen for: free licence (Google Fonts, OFL), readable at
 * price size on a phone, and one weight only (small download).
 *
 * A shop font is used for names, headings and prices only — descriptions and
 * small print always stay in the standard font so they stay readable.
 *
 * The actual font loading is in app/fonts/shopFonts.ts (next/font must run in
 * the app tree). Keys here and there must match; utils is safe to import from
 * API routes and client components without pulling any font files in.
 */
export const SHOP_FONT_CHOICES = [
  { key: "luckiest-guy", label: "Luckiest Guy", vibe: "bold hand-lettered sign" },
  { key: "lilita-one", label: "Lilita One", vibe: "chunky & friendly" },
  { key: "bungee", label: "Bungee", vibe: "street signage" },
  { key: "rye", label: "Rye", vibe: "old western saloon" },
  { key: "righteous", label: "Righteous", vibe: "retro groovy" },
  { key: "cinzel", label: "Cinzel", vibe: "carved, elegant, mystic" },
  { key: "permanent-marker", label: "Permanent Marker", vibe: "handwritten marker" },
  { key: "pacifico", label: "Pacifico", vibe: "surfy script" },
] as const;

export type ShopFontKey = (typeof SHOP_FONT_CHOICES)[number]["key"];

export function isShopFont(key: unknown): key is ShopFontKey {
  return SHOP_FONT_CHOICES.some((f) => f.key === key);
}

/** Guests' own switch, remembered per device. "off" = standard fonts everywhere. */
export const SHOP_FONTS_COOKIE = "ne_shop_fonts";
