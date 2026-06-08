import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "vendor" | "user" | null;

export type Profile = {
  role: UserRole;
  vendor_id: number | null;
  username: string | null;
};

export async function getProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
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
    .from("profiles")
    .select("id, username")
    .in("id", userIds);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; username: string | null }[]) {
    if (row.username) map[row.id] = row.username;
  }
  return map;
}
