import { serviceClient } from "@/utils/coordinator";
import { VENDOR_PUBLIC_COLUMNS } from "@/utils/vendorColumns";
import { myStoreSlug } from "@/utils/myStore";

/** The caller's own vendor (profile link or vendors.user_id), its store and FestDash status. */
export async function resolveMyVendor(userId: string) {
  const admin = serviceClient();
  const [{ data: prof }, { data: own }] = await Promise.all([
    admin.from("user_profiles").select("vendor_id, is_marketplace").eq("id", userId).maybeSingle(),
    admin.from("vendors").select("id").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  const vendorId = prof?.vendor_id ? Number(prof.vendor_id) : own?.id ? Number(own.id) : null;
  if (!vendorId) return null;
  const [{ data: vendor }, slug, { data: fd }] = await Promise.all([
    admin.from("vendors").select(`${VENDOR_PUBLIC_COLUMNS}, currency, pickup_location, fulfillment_modes`).eq("id", vendorId).maybeSingle(),
    myStoreSlug(admin, userId),
    admin.from("festdash_vendors").select("is_active").eq("vendor_id", vendorId).maybeSingle(),
  ]);
  if (!vendor) return null;
  const { data: store } = slug ? await admin.from("stores").select("slug, name, active, billing_status, owner_user_id").eq("slug", slug).maybeSingle() : { data: null };
  return { admin, vendorId, vendor, store: store ? { ...store, is_operator: store.owner_user_id === userId } : null, festdash: !!fd?.is_active };
}

