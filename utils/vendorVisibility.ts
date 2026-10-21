import { storeAdminClient } from "@/utils/store";

/**
 * Is this vendor showing to the public right now (approved, listed, and not
 * "lights out")? For hand-written cards that name a specific vendor — they are
 * typed into a page rather than read from the database, so suspension can't
 * hide them on its own. The home page and /marketplace both had a fixed Frank
 * card that stayed up after he was put lights out on 2026-10-18.
 */
export async function vendorIsPublic(vendorId: number): Promise<boolean> {
  const { data } = await storeAdminClient()
    .from("vendors")
    .select("status, is_public, suspended_at")
    .eq("id", vendorId)
    .maybeSingle();
  return !!data && data.status === "approved" && data.is_public === true && !data.suspended_at;
}
