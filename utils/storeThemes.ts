/**
 * Background themes for a shop's own pages (its store page, vendor page and
 * item pages). The main /marketplace always uses the NorthEDM look; a shop's
 * identity shows once you're on that shop.
 *
 * Themes are built per vendor from their own logo's palette and offered as
 * templates when the NorthEDM owner sets their site up. Accents in themes were
 * contrast-checked like utils/accent.ts: >= 4.5:1 as text on the theme's
 * darkest area AND behind black button text.
 *
 * `accent: null` means "use the store's own accent_color".
 */
export type StoreTheme = {
  key: string;
  label: string;
  /** Who it was made for, shown to the owner in /admin. */
  madeFor?: string;
  /** Full-page background (CSS). */
  background: string;
  /** Hero overlay (CSS background), drawn behind the store's name. */
  hero?: string;
  accent: string | null;
  /** Card surface on this background. */
  card: string;
  /** Decorative band under the hero. */
  band?: "awning";
};

export const STORE_THEMES: StoreTheme[] = [
  {
    key: "northedm",
    label: "NorthEDM (default)",
    background: "transparent",
    accent: null,
    card: "rgba(255,255,255,0.03)",
  },
  {
    key: "moonlit-midway",
    label: "Moonlit Midway",
    madeFor: "Find It @ Frank's",
    background: "radial-gradient(circle at 85% 4%, rgba(219,211,192,.40) 0, rgba(219,211,192,.08) 14%, transparent 28%), linear-gradient(180deg, #4B3F5D 0%, #311E31 40%, #1A1020 100%)",
    accent: "#83CFE3", // logo sky — 10.5:1 on #1A1020, 12.0:1 under black
    card: "rgba(255,255,255,0.05)",
  },
  {
    key: "campfire-glow",
    label: "Campfire Glow",
    madeFor: "Find It @ Frank's",
    background: "radial-gradient(ellipse at 50% 100%, rgba(235,190,129,.40) 0, rgba(201,127,91,.25) 20%, rgba(144,59,54,.12) 38%, transparent 55%), linear-gradient(180deg, #241A33 0%, #1A1020 55%, #140C14 100%)",
    accent: "#EBBE81", // logo firelight — 10.7:1 / 12.2:1
    card: "rgba(255,255,255,0.05)",
  },
  {
    key: "festival-dusk",
    label: "Festival Dusk",
    madeFor: "Find It @ Frank's",
    background: "linear-gradient(180deg, #83CFE3 0px, #797F94 220px, #4B3F5D 380px, #311E31 560px, #1A1020 900px, #1A1020 100%)",
    hero: "radial-gradient(ellipse at 20% 30%, rgba(224,198,152,.5), transparent 40%), radial-gradient(ellipse at 80% 18%, rgba(224,198,152,.35), transparent 35%)",
    accent: "#E0C698", // logo moonlit cream — 11.2:1 / 12.7:1
    card: "rgba(255,255,255,0.05)",
  },
  {
    key: "midway-awning",
    label: "Midway Awning",
    madeFor: "Find It @ Frank's",
    background: "linear-gradient(180deg, #311E31 0%, #241A33 30%, #1A1020 60%)",
    accent: "#E0C698",
    card: "rgba(255,255,255,0.05)",
    band: "awning",
  },
];

export function storeTheme(key: string | null | undefined): StoreTheme {
  return STORE_THEMES.find((t) => t.key === key) ?? STORE_THEMES[0];
}

export function isStoreTheme(key: unknown): boolean {
  return STORE_THEMES.some((t) => t.key === key);
}
