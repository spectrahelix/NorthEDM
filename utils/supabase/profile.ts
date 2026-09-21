import type { SupabaseClient } from "@supabase/supabase-js";

// user_profiles' vocabulary. The retired public.profiles table used a separate,
// NON-OVERLAPPING set (admin/vendor/user), which is why a check against the
// wrong table could never accidentally pass — it always failed closed.
export type UserRole = "archon" | "warden" | "merchant" | "drifter" | null;

/** Site administrators. Kept in one place so the check can't drift again. */
export function isAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === "archon" || role === "warden";
}

export type Profile = {
  role: UserRole;
  vendor_id: number | null;
  username: string | null;
};

export async function getProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("role, vendor_id, username")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

export async function getUsernames(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from("user_profiles")
    .select("id, username")
    .in("id", userIds);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; username: string | null }[]) {
    if (row.username) map[row.id] = row.username;
  }
  return map;
}
