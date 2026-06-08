import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "vendor" | "user" | null;

export type Profile = {
  role: UserRole;
  vendor_id: number | null;
};

export async function getProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role, vendor_id")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}
