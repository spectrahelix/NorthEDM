import type { SupabaseClient } from "@supabase/supabase-js";
import { rate } from "@/utils/fx";

/**
 * Gambian (wallet-rail) shops — interim rules (owner's decision, 2026-11-05).
 * Until NorthEDM has its own Gambian business and payment account (owner's
 * to-do starts with getting a passport — see AGENTS.md), customers of every
 * wallet-rail shop pay **by card or Google Pay only**, into NorthEDM's Stripe.
 * Wave / QMoney / Afrimoney (to the coordinator) and Waychit are switched off.
 * Each such card order carries a **transfer fee** — what Remitly charges the
 * owner to send the shop's and coordinator's shares to The Gambia — kept by
 * NorthEDM, outside the shop's split like the runner and service fees.
 *
 * Both are settings in coordinator_program_settings, changed on
 * /admin/festdash/coordinators: `local_wallets_enabled` (off) and
 * `remit_fee_usd_cents` (USD; converted to the shop's currency at order time).
 */
export type LocalRules = { walletsEnabled: boolean; remitFeeUsdCents: number };

export async function loadLocalRules(admin: SupabaseClient): Promise<LocalRules> {
  const { data } = await admin.from("coordinator_program_settings").select("local_wallets_enabled, remit_fee_usd_cents").eq("id", 1).maybeSingle();
  return { walletsEnabled: data?.local_wallets_enabled === true, remitFeeUsdCents: Number(data?.remit_fee_usd_cents ?? 399) };
}

/** The transfer fee in the shop's currency (minor units), rounded up to a whole unit. */
export async function remitFeeIn(currency: string, usdCents: number): Promise<number> {
  if (usdCents <= 0) return 0;
  const cur = String(currency || "USD").toUpperCase();
  if (cur === "USD") return usdCents;
  const r = await rate("USD", cur);
  const x = r ? usdCents * r.rate : 0;
  return x > 0 ? Math.ceil(x / 100) * 100 : 0;
}
