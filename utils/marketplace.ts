import type { SupabaseClient, User } from "@supabase/supabase-js";
import { canSell } from "@/utils/ranks";

const ADMIN_EMAIL = "cjblue27@gmail.com";

// Marketplace inventory management is a paid, admin-granted capability. Only
// users with is_marketplace access (or an admin) may create/edit/delete
// products. The Archon can always manage inventory.
export async function canManageInventory(
  supabase: SupabaseClient,
  user: User
): Promise<boolean> {
  if (user.email === ADMIN_EMAIL) return true;
  const { data } = await supabase
    .from("user_profiles")
    .select("role, extra_ranks, is_marketplace, is_festdash_vendor")
    .eq("id", user.id)
    .single();
  // A FestDash shop sells from the same products table, so it must be able to
  // add items without a separate marketplace grant (2026-11-03).
  // Merchant abilities (utils/ranks.ts): the seller tags, the Merchant rank
  // (primary or extra), archon (holds every rank) or warden.
  return canSell(data);
}
