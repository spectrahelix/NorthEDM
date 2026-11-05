/**
 * Waychit's processing fee (3%), carried by the customer (owner's decision,
 * 2026-11-04). Client-safe: no secrets, no node imports — used by checkout
 * pages to show the same number the server charges (utils/waychit.ts).
 *
 * Gross up so that after Waychit's fee the order total arrives whole:
 * charge = ceil(base / (1 − fee)), in whole dalasi (Waychit takes whole GMD).
 */
export const WAYCHIT_MIN_GMD = 5;
export function waychitCharge(baseCents: number, feeBps: number): { chargeGmd: number; processingFeeCents: number } {
  const gross = feeBps > 0 ? Math.ceil((baseCents * 10000) / (10000 - feeBps)) : baseCents;
  const chargeGmd = Math.max(WAYCHIT_MIN_GMD, Math.ceil(gross / 100));
  return { chargeGmd, processingFeeCents: chargeGmd * 100 - baseCents };
}
