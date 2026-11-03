import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One shipping calculator for every shop that posts parcels from the US:
 * NorthEDM's own shop and US vendor stores. Zones by destination country,
 * a few services per zone priced as base + per-kg, each with a transit
 * estimate. The numbers below are REFERENCE ESTIMATES modelled on USPS retail
 * tiers (Nov 2026), not live carrier quotes; the owner overrides them in
 * /admin/shipping (shipping_settings.rates) and they are shown to customers
 * as estimates. Postage itself is bought at the counter or in the carrier's
 * site — the label we print is the address + customs sheet.
 */
export type Zone = "us" | "na" | "eu" | "wafrica" | "world";
export type Service = { id: string; name: string; base_cents: number; per_kg_cents: number; max_kg?: number; eta: string; eta_days: [number, number] };
export type Rates = Record<Zone, Service[]>;

export const ZONE_LABEL: Record<Zone, string> = { us: "United States", na: "Canada & Mexico", eu: "Europe & UK", wafrica: "West Africa", world: "Rest of world" };

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" }, { code: "GM", name: "The Gambia" }, { code: "SN", name: "Senegal" }, { code: "GH", name: "Ghana" }, { code: "NG", name: "Nigeria" },
  { code: "SL", name: "Sierra Leone" }, { code: "GN", name: "Guinea" }, { code: "LR", name: "Liberia" }, { code: "CI", name: "Côte d'Ivoire" }, { code: "ML", name: "Mali" },
  { code: "CA", name: "Canada" }, { code: "MX", name: "Mexico" }, { code: "GB", name: "United Kingdom" }, { code: "IE", name: "Ireland" }, { code: "DE", name: "Germany" },
  { code: "FR", name: "France" }, { code: "NL", name: "Netherlands" }, { code: "BE", name: "Belgium" }, { code: "ES", name: "Spain" }, { code: "PT", name: "Portugal" },
  { code: "IT", name: "Italy" }, { code: "SE", name: "Sweden" }, { code: "NO", name: "Norway" }, { code: "DK", name: "Denmark" }, { code: "CH", name: "Switzerland" },
  { code: "AU", name: "Australia" }, { code: "NZ", name: "New Zealand" }, { code: "JP", name: "Japan" }, { code: "BR", name: "Brazil" }, { code: "ZA", name: "South Africa" },
];
const NA = new Set(["CA", "MX"]);
const EU = new Set(["GB", "IE", "DE", "FR", "NL", "BE", "LU", "ES", "PT", "IT", "AT", "SE", "NO", "DK", "FI", "CH", "PL", "CZ", "GR", "HU", "RO"]);
const WAFRICA = new Set(["GM", "SN", "GH", "NG", "SL", "GN", "GW", "LR", "CI", "ML", "BF", "TG", "BJ", "NE", "MR", "CV"]);
export function zoneFor(country: string): Zone {
  const c = String(country || "US").toUpperCase();
  if (c === "US") return "us";
  if (NA.has(c)) return "na";
  if (EU.has(c)) return "eu";
  if (WAFRICA.has(c)) return "wafrica";
  return "world";
}

export const DEFAULT_RATES: Rates = {
  us: [
    { id: "ground", name: "USPS Ground Advantage", base_cents: 650, per_kg_cents: 180, eta: "2–5 business days", eta_days: [2, 5] },
    { id: "priority", name: "USPS Priority Mail", base_cents: 950, per_kg_cents: 260, eta: "1–3 business days", eta_days: [1, 3] },
  ],
  na: [
    { id: "intl-first", name: "First-Class Package International", base_cents: 1800, per_kg_cents: 900, max_kg: 1.8, eta: "1–3 weeks", eta_days: [7, 21] },
    { id: "intl-priority", name: "Priority Mail International", base_cents: 4000, per_kg_cents: 1200, eta: "6–10 business days", eta_days: [6, 10] },
  ],
  eu: [
    { id: "intl-first", name: "First-Class Package International", base_cents: 2000, per_kg_cents: 1200, max_kg: 1.8, eta: "1–3 weeks", eta_days: [7, 21] },
    { id: "intl-priority", name: "Priority Mail International", base_cents: 5000, per_kg_cents: 1800, eta: "6–10 business days", eta_days: [6, 10] },
  ],
  wafrica: [
    { id: "intl-first", name: "First-Class Package International", base_cents: 2200, per_kg_cents: 1400, max_kg: 1.8, eta: "2–4 weeks", eta_days: [14, 28] },
    { id: "intl-priority", name: "Priority Mail International", base_cents: 6000, per_kg_cents: 2200, eta: "6–12 business days", eta_days: [6, 12] },
  ],
  world: [
    { id: "intl-first", name: "First-Class Package International", base_cents: 2200, per_kg_cents: 1400, max_kg: 1.8, eta: "2–4 weeks", eta_days: [14, 28] },
    { id: "intl-priority", name: "Priority Mail International", base_cents: 6000, per_kg_cents: 2400, eta: "6–10 business days", eta_days: [6, 10] },
  ],
};

/** Items without a weight count as 300 g each; packaging adds 10% + 60 g. */
export const DEFAULT_ITEM_WEIGHT_G = 300;
export function packageWeightG(items: { weight_g?: number | null; qty: number }[]): number {
  const net = items.reduce((s, i) => s + (Number(i.weight_g) > 0 ? Number(i.weight_g) : DEFAULT_ITEM_WEIGHT_G) * Math.max(1, Number(i.qty) || 1), 0);
  return Math.ceil(net * 1.1 + 60);
}

export type Quote = { zone: Zone; zone_label: string; weight_g: number; options: { id: string; name: string; cents: number; eta: string; eta_days: [number, number] }[] };
export function quoteShipping(args: { items: { weight_g?: number | null; qty: number }[]; country: string; rates?: Partial<Rates> | null; handlingCents?: number }): Quote {
  const zone = zoneFor(args.country);
  const weight_g = packageWeightG(args.items);
  const kg = weight_g / 1000;
  const table = (args.rates?.[zone] && args.rates[zone]!.length ? args.rates[zone]! : DEFAULT_RATES[zone]);
  const options = table
    .filter((s) => !s.max_kg || kg <= s.max_kg)
    .map((s) => ({ id: s.id, name: s.name, cents: Math.round(s.base_cents + s.per_kg_cents * Math.ceil(kg * 10) / 10 + (args.handlingCents ?? 0)), eta: s.eta, eta_days: s.eta_days }))
    .sort((a, b) => a.cents - b.cents);
  return { zone, zone_label: ZONE_LABEL[zone], weight_g, options };
}

export type ShipFrom = { name?: string; line1?: string; line2?: string; city?: string; region?: string; postal_code?: string; country?: string; phone?: string; email?: string } | null;
export async function loadShippingSettings(admin: SupabaseClient): Promise<{ ship_from: ShipFrom; handling_cents: number; rates: Partial<Rates> | null }> {
  const { data } = await admin.from("shipping_settings").select("ship_from, handling_cents, rates").eq("id", 1).maybeSingle();
  return { ship_from: (data?.ship_from as ShipFrom) ?? null, handling_cents: Number(data?.handling_cents ?? 0), rates: (data?.rates as Partial<Rates> | null) ?? null };
}
