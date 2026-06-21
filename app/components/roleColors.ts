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
