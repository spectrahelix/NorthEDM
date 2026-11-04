import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * FestDash service fee + passes (owner's decision, 2026-11-04).
 * Every FestDash order carries a service fee — `service_fee_bps` of the items
 * (5%), at least `service_fee_min_cents` ($1, USD orders) — that NorthEDM
 * keeps; it covers card processing. A FestDash pass waives it for its length.
 * Passes are one-time purchases (2-day, weekend, 7-day, monthly) priced in
 * `coordinator_program_settings.festdash_passes`; buying another while one
 * runs extends it.
 */
export type PassOption = { key: string; label: string; days: number; price_cents: number };
export type FeeSettings = { service_fee_bps: number; service_fee_min_cents: number; festdash_passes: PassOption[] };
export const DEFAULT_PASSES: PassOption[] = [
  { key: "2day", label: "2-day pass", days: 2, price_cents: 399 },
  { key: "3day", label: "Weekend pass (3 days)", days: 3, price_cents: 499 },
  { key: "7day", label: "7-day pass", days: 7, price_cents: 699 },
  { key: "monthly", label: "Monthly pass (30 days)", days: 30, price_cents: 999 },
];

export async function loadFeeSettings(admin: SupabaseClient): Promise<FeeSettings> {
  const { data } = await admin.from("coordinator_program_settings").select("service_fee_bps, service_fee_min_cents, festdash_passes").eq("id", 1).maybeSingle();
  return {
    service_fee_bps: Number(data?.service_fee_bps ?? 500),
    service_fee_min_cents: Number(data?.service_fee_min_cents ?? 100),
    festdash_passes: Array.isArray(data?.festdash_passes) && data!.festdash_passes.length ? (data!.festdash_passes as PassOption[]) : DEFAULT_PASSES,
  };
}

/** The fee on an order's items (after any code discount). Members pay 0. The $ minimum applies to USD orders only. */
export function serviceFeeCents(itemsCents: number, currency: string, s: FeeSettings, member: boolean): number {
  if (member || itemsCents <= 0 || s.service_fee_bps <= 0) return 0;
  const pct = Math.round((itemsCents * s.service_fee_bps) / 10000);
  return String(currency || "USD").toUpperCase() === "USD" ? Math.max(pct, s.service_fee_min_cents) : pct;
}

/** The user's pass that is running now, if any. */
export async function activePass(admin: SupabaseClient, userId: string | null | undefined) {
  if (!userId) return null;
  const now = new Date().toISOString();
  const { data } = await admin.from("festdash_member_passes").select("id, pass_key, days, starts_at, ends_at")
    .eq("user_id", userId).eq("status", "active").lte("starts_at", now).gt("ends_at", now)
    .order("ends_at", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

/** Activate a paid pass (webhook). Starts now, or when the user's current pass ends, so passes stack. Idempotent. */
export async function activatePass(admin: SupabaseClient, passId: string) {
  const { data: p } = await admin.from("festdash_member_passes").select("id, user_id, days, status").eq("id", passId).maybeSingle();
  if (!p || p.status === "active") return;
  const { data: latest } = await admin.from("festdash_member_passes").select("ends_at")
    .eq("user_id", p.user_id).eq("status", "active").order("ends_at", { ascending: false }).limit(1).maybeSingle();
  const startMs = Math.max(Date.now(), latest?.ends_at ? new Date(latest.ends_at).getTime() : 0);
  const starts = new Date(startMs);
  const ends = new Date(startMs + Number(p.days) * 86400e3);
  await admin.from("festdash_member_passes").update({ status: "active", starts_at: starts.toISOString(), ends_at: ends.toISOString() }).eq("id", p.id).eq("status", "pending");
}
