import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Gambian payment bridge intake (AGENTS.md → "Stage two"). One row per
 * coordinator: business, bank and aggregator details, entered by the
 * coordinator in /festdash/purse and reviewed by the owner in
 * /admin/festdash/coordinators. Service role only; secrets go out masked.
 */
export const BRIDGE_PROVIDERS = [
  { id: "waychit", name: "Waychit", note: "Preferred. One API for Wave, QMoney, Afrimoney and cards. No sandbox — test payments move real money." },
  { id: "modempay", name: "Modem Pay", note: "Second choice. Says it is licensed by the Central Bank of The Gambia; same payment methods." },
] as const;
export const BRIDGE_TEXT_FIELDS = ["business_name", "registration_number", "tin", "business_address", "bank_name", "bank_account_name", "bank_account_number", "bank_swift", "merchant_id", "provider_contact", "notes"] as const;
export const BRIDGE_SECRET_FIELDS = ["api_key", "webhook_secret"] as const;
export const BRIDGE_MASKED = [...BRIDGE_SECRET_FIELDS, "bank_account_number", "tin"] as const;
export type BridgeRow = Record<(typeof BRIDGE_TEXT_FIELDS)[number] | (typeof BRIDGE_SECRET_FIELDS)[number], string | null> & {
  user_id: string; provider: "waychit" | "modempay"; status: "draft" | "submitted" | "verified" | "live"; bank_can_send_usd: boolean | null;
  owner_notes: string | null; submitted_at: string | null; verified_at: string | null; updated_at: string;
};

/** Last four characters only; the UI shows "saved" and lets the person overwrite. */
export function maskBridge(row: BridgeRow | null) {
  if (!row) return null;
  const out: Record<string, unknown> = { ...row };
  for (const k of BRIDGE_MASKED) {
    const v = row[k];
    out[k] = v ? `••••${String(v).slice(-4)}` : null;
    out[`${k}_set`] = !!v;
  }
  return out;
}

/** Clean an incoming patch: only known fields, trimmed, blanks ignored (keep what is saved). */
export function cleanBridgePatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const k of [...BRIDGE_TEXT_FIELDS, ...BRIDGE_SECRET_FIELDS]) {
    const v = body[k];
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue; // blank = unchanged
    if (t.startsWith("••••")) continue; // the mask echoed back
    patch[k] = t.slice(0, k === "notes" || k === "business_address" ? 600 : 200);
  }
  if (body.provider === "waychit" || body.provider === "modempay") patch.provider = body.provider;
  if (typeof body.bank_can_send_usd === "boolean") patch.bank_can_send_usd = body.bank_can_send_usd;
  return patch;
}

export async function loadBridge(admin: SupabaseClient, userId: string): Promise<BridgeRow | null> {
  const { data } = await admin.from("coordinator_bridge").select("*").eq("user_id", userId).maybeSingle();
  return (data as BridgeRow | null) ?? null;
}
