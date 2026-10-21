import { storeAdminClient } from "@/utils/store";

/**
 * Is this vendor showing to the public right now (approved, listed, and not
 * "lights out")? For hand-written cards that name a specific vendor — they are
 * typed into a page rather than read from the database, so suspension can't
 * hide them on its own. The home page and /marketplace both had a fixed Frank
 * card that stayed up after he was put lights out on 2026-10-18.
 */
/** Which of these vendors are showing to the public right now — one query. */
export async function publicVendorIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const { data } = await storeAdminClient()
    .from("vendors")
    .select("id, status, is_public, suspended_at")
    .in("id", ids);
  return new Set(
    (data ?? [])
      .filter((v) => v.status === "approved" && v.is_public === true && !v.suspended_at)
      .map((v) => Number(v.id)),
  );
}

export async function vendorIsPublic(vendorId: number): Promise<boolean> {
  return (await publicVendorIds([vendorId])).has(vendorId);
}
