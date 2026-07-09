import type { SupabaseClient, User } from "@supabase/supabase-js";

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
    .select("role, is_marketplace")
    .eq("id", user.id)
    .single();
  return (
    !!data?.is_marketplace || data?.role === "archon" || data?.role === "warden"
  );
}
