import type { SupabaseClient } from "@supabase/supabase-js";
import { WHOLE_UNIT } from "@/utils/currencies";

/**
 * Gambian (wallet-rail) shops — interim rules (owner's decisions, 2026-11-05).
 * Until NorthEDM has its own Gambian business and payment account (owner's
 * to-do starts with getting a passport — see AGENTS.md), customers of every
 * wallet-rail shop pay **by card or Google Pay only**, into NorthEDM's Stripe.
 * Wave / QMoney / Afrimoney (to the coordinator) and Waychit are switched off.
 * Each such card order carries a **transfer fee** — `remit_fee_bps` (3%) of
 * the order — covering what Remitly charges the owner to send the shop's and
 * coordinator's shares to The Gambia. NorthEDM keeps it, outside the shop's
 * split like the runner and service fees.
 *
 * Both are settings in coordinator_program_settings, changed on
 * /admin/festdash/coordinators: `local_wallets_enabled` (off) and
 * `remit_fee_bps`. Client-safe apart from loadLocalRules (pass a client).
 */
export type LocalRules = { walletsEnabled: boolean; remitFeeBps: number };

export async function loadLocalRules(admin: SupabaseClient): Promise<LocalRules> {
  const { data } = await admin.from("coordinator_program_settings").select("local_wallets_enabled, remit_fee_bps").eq("id", 1).maybeSingle();
  return { walletsEnabled: data?.local_wallets_enabled === true, remitFeeBps: Number(data?.remit_fee_bps ?? 300) };
}

/** The transfer fee on `baseCents` (minor units), rounded up — to a whole unit for whole-unit currencies like GMD. */
export function transferFeeCents(baseCents: number, currency: string, bps: number): number {
  if (baseCents <= 0 || bps <= 0) return 0;
  const raw = Math.ceil((baseCents * bps) / 10000);
  return WHOLE_UNIT.has(String(currency || "USD").toUpperCase()) ? Math.ceil(raw / 100) * 100 : raw;
}
