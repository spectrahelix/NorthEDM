import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocalRail } from "@/utils/gambiaPay";
import { coordinatorFor } from "@/utils/coordinator";

/**
 * Which rail an embedded store's checkout takes. The store's operator account
 * points at a vendor; if that vendor is on the wallet rail (a coordinator plus a
 * non-USD currency), the store sells for wallets paid to the coordinator, in
 * the vendor's currency. Otherwise Stripe card checkout, as before.
 */
export async function storeRail(admin: SupabaseClient, ownerUserId: string | null) {
  if (!ownerUserId) return null;
  const { data: prof } = await admin.from("user_profiles").select("vendor_id").eq("id", ownerUserId).maybeSingle();
  if (!prof?.vendor_id) return null;
  const { data: vendor } = await admin.from("vendors").select("id, coordinator_user_id, currency").eq("id", prof.vendor_id).maybeSingle();
  if (!vendor || !isLocalRail(vendor)) return null;
  const purse = await coordinatorFor(admin, vendor.coordinator_user_id as string);
  return {
    vendorId: Number(vendor.id),
    coordinatorUserId: vendor.coordinator_user_id as string,
    currency: String(vendor.currency || "GMD"),
    coordinatorName: purse?.display_name ?? null,
    numbers: { wave: purse?.wave_number ?? null, qmoney: purse?.qmoney_number ?? null, afrimoney: purse?.afrimoney_number ?? null, whatsapp: purse?.whatsapp_number ?? null },
  };
}
