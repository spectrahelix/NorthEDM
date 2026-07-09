// Shared role colors/config — plain module (no "use client") so it can be used
// from both server components (e.g. profile page) and client components
// (RankBadge). Calling a function exported from a "use client" module on the
// server throws, which is why this lives separately.

export type ForumRole = "archon" | "warden" | "merchant" | "wanderer" | "drifter";

export const ROLE_CONFIG: Record<
  ForumRole,
  { label: string; color: string; effect: "sparkle" | "pulse" | "none" }
> = {
  archon:   { label: "Archon",   color: "#7DF9FF", effect: "sparkle" },
  warden:   { label: "Warden",   color: "#FF9A3C", effect: "sparkle" },
  merchant: { label: "Merchant", color: "#7FFF6E", effect: "sparkle" },
  wanderer: { label: "Wanderer", color: "#F5E6C8", effect: "pulse"   },
  drifter:  { label: "Drifter",  color: "#A8A8A8", effect: "none"    },
};

export function getRoleColor(role: string): string {
  return ROLE_CONFIG[role as ForumRole]?.color ?? ROLE_CONFIG.drifter.color;
}

// Approval tags shown as chips next to a name (profile + forum + hover cards).
// Order here = display order. Each maps to a boolean flag on user_profiles.
export type TagKey =
  | "founder"
  | "vendor"
  | "marketplace"
  | "festdash_vendor"
  | "promoter"
  | "artisan";

export const TAG_CONFIG: Record<
  TagKey,
  { label: string; color: string; glyph: string; flag: string }
> = {
  founder:         { label: "Founder",     color: "#CC00FF", glyph: "♛", flag: "is_founder" },
  vendor:          { label: "Vendor",      color: "#39FF14", glyph: "⬢", flag: "is_vendor" },
  marketplace:     { label: "Marketplace", color: "#00D4FF", glyph: "▣", flag: "is_marketplace" },
  festdash_vendor: { label: "FestDash",    color: "#FB923C", glyph: "◆", flag: "is_festdash_vendor" },
  promoter:        { label: "Promoter",    color: "#E8FF47", glyph: "✦", flag: "is_promoter" },
  artisan:         { label: "Artisan",     color: "#FFC93C", glyph: "◈", flag: "is_artisan" },
};

export const TAG_ORDER: TagKey[] = ["founder", "vendor", "marketplace", "festdash_vendor", "promoter", "artisan"];
