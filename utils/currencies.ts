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
