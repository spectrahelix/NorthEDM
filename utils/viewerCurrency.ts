import { cookies, headers } from "next/headers";
import { currencyForCountry } from "@/utils/currencies";

export const VIEW_CURRENCY_COOKIE = "ne_currency";
export const VIEW_CURRENCIES = ["USD", "GMD", "XOF", "GHS", "NGN", "GBP", "EUR", "CAD", "MXN", "AUD", "JPY", "ZAR", "BRL"];

/**
 * The currency a visitor wants prices SHOWN in (display only — what they are
 * charged is always the shop's currency, see utils/currencies.ts). Picked with
 * the "Prices in" pill (cookie), otherwise guessed from Vercel's country header.
 */
export async function viewerCurrency(): Promise<string> {
  const c = (await cookies()).get(VIEW_CURRENCY_COOKIE)?.value?.toUpperCase();
  if (c && VIEW_CURRENCIES.includes(c)) return c;
  const country = (await headers()).get("x-vercel-ip-country");
  const guess = currencyForCountry(country);
  return VIEW_CURRENCIES.includes(guess) ? guess : "USD";
}
