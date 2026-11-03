/**
 * Money display. Every amount in the database is in minor units (cents for
 * dollars, bututs for dalasi); this is the one place that turns them into text.
 */
const SYMBOL: Record<string, string> = { USD: "$", GMD: "D", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$", NZD: "NZ$", MXN: "MX$", JPY: "¥", NGN: "₦", GHS: "GH₵", ZAR: "R", BRL: "R$", XOF: "CFA ", SLE: "Le ", GNF: "FG ", LRD: "L$", CHF: "CHF ", SEK: "kr ", NOK: "kr ", DKK: "kr " };

export function formatMoney(cents: number, currency: string = "USD"): string {
  const code = (currency || "USD").toUpperCase();
  const sym = SYMBOL[code] ?? `${code} `;
  const abs = (Math.abs(cents) / 100).toFixed(2);
  return `${cents < 0 ? "−" : ""}${sym}${abs}`;
}

export function currencyName(currency: string): string {
  const code = (currency || "USD").toUpperCase();
  const names: Record<string, string> = { GMD: "dalasi", USD: "dollars", GBP: "pounds", EUR: "euros", CAD: "Canadian dollars", XOF: "CFA francs", GHS: "cedis", NGN: "naira", SLE: "leones", GNF: "Guinean francs", LRD: "Liberian dollars", MXN: "pesos", JPY: "yen", ZAR: "rand", BRL: "reais" };
  return names[code] ?? code;
}
