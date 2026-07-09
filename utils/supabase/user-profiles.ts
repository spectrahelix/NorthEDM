import type { SupabaseClient } from "@supabase/supabase-js";
import { TAG_ORDER, type TagKey } from "@/app/components/roleColors";

export type ForumRole = "archon" | "warden" | "merchant" | "wanderer" | "drifter";

export type Social = { label: string; url: string };

export type UserProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_border: string;
  bio: string;
  home_city: string;
  role: ForumRole;
  created_at: string;
  // Artisan + expanded profile fields
  is_artisan?: boolean;
  artisan_status?: "none" | "pending" | "approved";
  stage_name?: string | null;
  artisan_craft?: string | null;
  artisan_statement?: string | null;
  pronouns?: string | null;
  website?: string | null;
  socials?: Social[] | null;
  // Approval tags (denormalized flags)
  is_vendor?: boolean;
  is_marketplace?: boolean;
  is_festdash_vendor?: boolean;
  is_promoter?: boolean;
  is_founder?: boolean;
  hidden_tags?: string[] | null;
  // Personal info (checkout autofill)
  full_name?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
};

// The ordered tag keys a profile has earned. Pass forum=true to drop any the
// user chose to hide from the forum (they always show on their own profile).
export function profileTags(
  p: Pick<UserProfile, "is_founder" | "is_vendor" | "is_marketplace" | "is_festdash_vendor" | "is_promoter" | "is_artisan" | "hidden_tags">,
  opts: { forum?: boolean } = {}
): TagKey[] {
  const has: Record<TagKey, boolean | undefined> = {
    founder: p.is_founder,
    vendor: p.is_vendor,
    marketplace: p.is_marketplace,
    festdash_vendor: p.is_festdash_vendor,
    promoter: p.is_promoter,
    artisan: p.is_artisan,
  };
  const hidden = new Set(opts.forum ? p.hidden_tags ?? [] : []);
  return TAG_ORDER.filter((k) => has[k] && !hidden.has(k));
}

export type ArtisanWork = {
  id: number;
  user_id: string;
  kind: "image" | "embed" | "link";
  title: string | null;
  caption: string | null;
  image_url: string | null;
  url: string | null;
  sort: number;
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
