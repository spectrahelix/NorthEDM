/**
 * Money display. Every amount in the database is in minor units (cents for
 * dollars, bututs for dalasi); this is the one place that turns them into text.
 */
const SYMBOL: Record<string, string> = { USD: "$", GMD: "D" };

export function formatMoney(cents: number, currency: string = "USD"): string {
  const code = (currency || "USD").toUpperCase();
  const sym = SYMBOL[code] ?? `${code} `;
  const abs = (Math.abs(cents) / 100).toFixed(2);
  return `${cents < 0 ? "−" : ""}${sym}${abs}`;
}

export function currencyName(currency: string): string {
  const code = (currency || "USD").toUpperCase();
  if (code === "GMD") return "dalasi";
  if (code === "USD") return "dollars";
  return code;
}
