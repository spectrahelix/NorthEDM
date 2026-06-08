import type { SupabaseClient } from "@supabase/supabase-js";

export type ForumRole = "archon" | "warden" | "merchant" | "wanderer" | "drifter";

export type UserProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_border: string;
  bio: string;
  home_city: string;
  role: ForumRole;
  created_at: string;
};

export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data as UserProfile | null;
}

export async function getUserProfileMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Record<string, UserProfile>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .in("id", userIds);
  const map: Record<string, UserProfile> = {};
  for (const row of (data ?? []) as UserProfile[]) {
    map[row.id] = row;
  }
  return map;
}

export async function getMyUserProfile(
  supabase: SupabaseClient
): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserProfile(supabase, user.id);
}

export function displayName(profile: UserProfile | undefined, fallback = "Unknown"): string {
  return profile?.display_name?.trim() || fallback;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}
