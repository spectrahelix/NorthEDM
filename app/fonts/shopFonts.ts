import { Luckiest_Guy, Lilita_One, Bungee, Rye, Righteous, Cinzel, Permanent_Marker, Pacifico } from "next/font/google";
import type { ShopFontKey } from "@/utils/storeFonts";

// Loaded only where a shop page imports this module, and preload is off: the
// browser downloads a font file only when text on the page actually uses it,
// so a page with no shop fonts costs nothing. (next/font requires each call's
// options as literals — a shared options object fails the build.)
const luckiest = Luckiest_Guy({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const lilita = Lilita_One({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const bungee = Bungee({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const rye = Rye({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const righteous = Righteous({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const cinzel = Cinzel({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const pacifico = Pacifico({ weight: "400", subsets: ["latin"], display: "swap", preload: false });

const FAMILY: Record<ShopFontKey, string> = {
  "luckiest-guy": luckiest.style.fontFamily,
  "lilita-one": lilita.style.fontFamily,
  bungee: bungee.style.fontFamily,
  rye: rye.style.fontFamily,
  righteous: righteous.style.fontFamily,
  cinzel: cinzel.style.fontFamily,
  "permanent-marker": marker.style.fontFamily,
  pacifico: pacifico.style.fontFamily,
};

export function shopFontFamily(key: string | null | undefined): string | null {
  return key && key in FAMILY ? FAMILY[key as ShopFontKey] : null;
}
