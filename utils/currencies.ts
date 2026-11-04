/**
 * Country → the currency a shop there sells in. Chosen once on shop setup;
 * every price the shop enters is stored in this currency and the price box
 * shows the USD equivalent live (and the other way round) via /api/fx.
 */
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", GM: "GMD", SN: "XOF", ML: "XOF", CI: "XOF", GH: "GHS", NG: "NGN", SL: "SLE", GN: "GNF", LR: "LRD",
  CA: "CAD", MX: "MXN", GB: "GBP", IE: "EUR", DE: "EUR", FR: "EUR", NL: "EUR", BE: "EUR", ES: "EUR", PT: "EUR", IT: "EUR",
  SE: "SEK", NO: "NOK", DK: "DKK", CH: "CHF", AU: "AUD", NZ: "NZD", JP: "JPY", BR: "BRL", ZA: "ZAR",
};
export function currencyForCountry(country: string | null | undefined): string {
  return COUNTRY_CURRENCY[String(country || "US").toUpperCase()] ?? "USD";
}
/** Currencies without minor units in everyday use — prices are shown whole. */
export const WHOLE_UNIT = new Set(["GMD", "XOF", "GNF", "JPY", "NGN", "SLE"]);

/** Display name for an ISO-2 country, from the shared list (falls back to the code). */
export function countryName(code: string | null | undefined): string {
  const c = String(code || "US").toUpperCase();
  return COUNTRY_NAMES[c] ?? c;
}
const COUNTRY_NAMES: Record<string, string> = {
  US: "the United States", GM: "The Gambia", SN: "Senegal", GH: "Ghana", NG: "Nigeria", SL: "Sierra Leone", GN: "Guinea", LR: "Liberia",
  CI: "Côte d'Ivoire", ML: "Mali", CA: "Canada", MX: "Mexico", GB: "the United Kingdom", IE: "Ireland", DE: "Germany", FR: "France",
  NL: "the Netherlands", BE: "Belgium", ES: "Spain", PT: "Portugal", IT: "Italy", SE: "Sweden", NO: "Norway", DK: "Denmark",
  CH: "Switzerland", AU: "Australia", NZ: "New Zealand", JP: "Japan", BR: "Brazil", ZA: "South Africa",
};
/** 🇬🇲 from "GM" (regional-indicator letters). */
export function flagEmoji(code: string | null | undefined): string {
  const c = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌍";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
