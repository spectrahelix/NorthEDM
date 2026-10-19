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
  band?: "awning" | "spectrum";
  /** Show the store's logo as a faint watermark behind the page. */
  watermark?: boolean;
};

// The Obsidian Cloak's logo palette (sampled from the logo): obsidian #1B1B1D,
// pearl #E2DCDB, and the seven chakra petals.
const CHAKRA = { amethyst: "108,71,149", sky: "74,152,201", leaf: "158,193,85", sun: "254,216,95", amber: "246,165,83", rose: "230,103,133", orchid: "203,75,145" };

// Four-point sparkles in the chakra colours, like the ones around his lotus —
// a small SVG tile repeated across the page.
const sparkle = (x: number, y: number, s: number, fill: string, o: number) =>
  `<path transform='translate(${x} ${y}) scale(${s})' d='M0-10C1-3 3-1 10 0C3 1 1 3 0 10C-1 3-3 1-10 0C-3-1-1-3 0-10Z' fill='${fill}' fill-opacity='${o}'/>`;
const SPARKLE_TILE = "url(\"data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='380' height='380'>` +
  sparkle(40, 60, 0.6, "#FED85F", 0.32) + sparkle(300, 40, 0.4, "#4A98C9", 0.32) + sparkle(190, 210, 0.3, "#E66785", 0.3) +
  sparkle(340, 280, 0.5, "#9EC155", 0.28) + sparkle(90, 320, 0.35, "#CB4B91", 0.3) +
  `<circle cx='150' cy='110' r='1.2' fill='#E2DCDB' fill-opacity='.22'/><circle cx='250' cy='330' r='1' fill='#E2DCDB' fill-opacity='.2'/><circle cx='30' cy='200' r='1' fill='#E2DCDB' fill-opacity='.2'/>` +
  `</svg>`) + "\")";

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
    background: "radial-gradient(circle at 84% 70px, #F8F8F4 0, #EDE6D2 26px, rgba(219,211,192,.55) 30px, rgba(219,211,192,.18) 90px, transparent 200px), radial-gradient(ellipse 60% 220px at 12% 160px, rgba(93,91,129,.55), transparent 70%), radial-gradient(ellipse 70% 260px at 95% 330px, rgba(75,63,93,.6), transparent 70%), linear-gradient(180deg, #2A2340 0%, #241A33 35%, #1A1020 65%, #120A16 100%)",
    accent: "#83CFE3", // logo sky — 10.5:1 on #1A1020, 12.0:1 under black
    card: "rgba(255,255,255,0.05)",
  },
  {
    key: "campfire-glow",
    label: "Campfire Glow",
    madeFor: "Find It @ Frank's",
    background: "radial-gradient(ellipse 90% 340px at 30% 470px, rgba(235,190,129,.42) 0, rgba(201,127,91,.30) 30%, rgba(144,59,54,.18) 55%, transparent 80%), linear-gradient(180deg, #1C1424 0%, #1A1020 40%, #140C14 100%)",
    hero: "radial-gradient(ellipse 70% 60% at 25% 105%, rgba(240,138,42,.35), transparent 70%)",
    accent: "#EBBE81", // logo firelight — 10.7:1 / 12.2:1
    card: "rgba(255,255,255,0.05)",
  },
  {
    key: "festival-dusk",
    label: "Festival Dusk",
    madeFor: "Find It @ Frank's",
    // The logo's lit sky glows in from the top-right; the left, where the text
    // sits, stays dusk-dark — a bright sky behind text measured 1.1-1.8:1.
    background: "radial-gradient(ellipse 55% 300px at 100% 0, rgba(131,207,227,.85) 0, rgba(131,207,227,.4) 35%, rgba(121,127,148,.15) 65%, transparent 85%), radial-gradient(ellipse 45% 90px at 78% 230px, rgba(224,198,152,.35), transparent 75%), linear-gradient(180deg, #22324A 0px, #2E3352 200px, #3B3150 360px, #2A1D33 560px, #1A1020 900px, #1A1020 100%)",
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

// ── The Obsidian Cloak (Travis) ──────────────────────────────────────────
STORE_THEMES.push(
  {
    key: "obsidian-lotus",
    label: "Obsidian Lotus",
    madeFor: "The Obsidian Cloak",
    // His lotus as a soft aura fanning across the top: petals left→right in logo order.
    background: [
      `radial-gradient(ellipse 30% 240px at 8% 260px, rgba(${CHAKRA.amethyst},.40), transparent 70%)`,
      `radial-gradient(ellipse 28% 240px at 20% 150px, rgba(${CHAKRA.sky},.32), transparent 70%)`,
      `radial-gradient(ellipse 26% 230px at 36% 70px, rgba(${CHAKRA.leaf},.26), transparent 70%)`,
      `radial-gradient(ellipse 26% 230px at 52% 30px, rgba(${CHAKRA.sun},.24), transparent 70%)`,
      `radial-gradient(ellipse 26% 230px at 68% 70px, rgba(${CHAKRA.amber},.26), transparent 70%)`,
      `radial-gradient(ellipse 28% 240px at 82% 150px, rgba(${CHAKRA.rose},.30), transparent 70%)`,
      `radial-gradient(ellipse 30% 240px at 94% 260px, rgba(${CHAKRA.orchid},.36), transparent 70%)`,
      "linear-gradient(180deg, #121016 0%, #0E0C12 45%, #09080C 100%)",
    ].join(", "),
    accent: "#9F7AEA", // his deep amethyst — 6.0:1 on obsidian, 6.4:1 under black
    card: "rgba(255,255,255,0.04)",
    watermark: true,
  },
  {
    key: "chakra-spectrum",
    label: "Chakra Spectrum",
    madeFor: "The Obsidian Cloak",
    // A thin aurora along the top in his seven petal colours, then obsidian;
    // a glowing chakra band runs under the header.
    background: [
      "linear-gradient(180deg, rgba(14,12,18,0) 0, rgba(14,12,18,.55) 150px, #0E0C12 340px)",
      `linear-gradient(90deg, rgba(${CHAKRA.amethyst},.34), rgba(${CHAKRA.sky},.30), rgba(${CHAKRA.leaf},.26), rgba(${CHAKRA.sun},.24), rgba(${CHAKRA.amber},.26), rgba(${CHAKRA.rose},.30), rgba(${CHAKRA.orchid},.34)) top / 100% 360px no-repeat`,
      "#0E0C12",
    ].join(", "),
    accent: "#E2DCDB", // pearl — 14.3:1 / 15.5:1
    card: "rgba(255,255,255,0.04)",
    band: "spectrum",
  },
  {
    key: "starlit-grove",
    label: "Starlit Grove",
    madeFor: "The Obsidian Cloak",
    // A violet night scattered with his chakra-coloured sparkles.
    background: [
      SPARKLE_TILE,
      `radial-gradient(ellipse 80% 420px at 50% 0, rgba(${CHAKRA.amethyst},.45), transparent 75%)`,
      "linear-gradient(180deg, #1A1324 0%, #120E19 45%, #0B090F 100%)",
    ].join(", "),
    accent: "#E66785", // his rose petal — 6.2:1 / 6.6:1
    card: "rgba(255,255,255,0.045)",
  },
);

export function storeTheme(key: string | null | undefined): StoreTheme {
  return STORE_THEMES.find((t) => t.key === key) ?? STORE_THEMES[0];
}

export function isStoreTheme(key: unknown): boolean {
  return STORE_THEMES.some((t) => t.key === key);
}
