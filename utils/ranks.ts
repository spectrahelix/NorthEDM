/**
 * Ranks (owner's rules, 2026-11-04). A person has one primary rank —
 * `user_profiles.role`, which sets their badge and, for warden/archon, admin
 * power — plus any number of `extra_ranks` whose abilities they also hold.
 *
 * - **Archon holds every rank's abilities** (merchant, promoter, wanderer) and
 *   the Marketplace and FestDash seller abilities, without storing them.
 * - Extra ranks are only the non-admin ones: admin power comes from the
 *   primary role alone, so no extra rank ever makes someone an admin.
 * - Who may change extra ranks: archon and warden (any of them), and site
 *   moderators (`is_site_moderator`) — but a moderator can't touch an admin's
 *   ranks. Only an archon makes someone a moderator.
 *
 * Client-safe: no imports, no secrets.
 */
export const PRIMARY_RANKS = ["drifter", "wanderer", "merchant", "promoter", "warden", "archon"] as const;
export const EXTRA_RANKS = ["wanderer", "merchant", "promoter"] as const;

/**
 * Ranks vs tags (owner, 2026-11-05). A RANK is where someone stands on the
 * site — one each: new member, regular, moderator, admin. Everything a person
 * is approved FOR (selling, promoting, driving…) is a TAG, and anyone can hold
 * any number of them (utils/memberTags.ts). Merchant and Promoter used to be
 * ranks; they are tags now, stored where the abilities already read them
 * (`extra_ranks` + their flags), so `hasRank()` / `canSell()` are unchanged.
 */
export const SITE_RANKS = ["drifter", "wanderer", "warden", "archon"] as const;
export type SiteRank = (typeof SITE_RANKS)[number];
export const RANK_INFO: Record<SiteRank, { label: string; meaning: string }> = {
  drifter: { label: "Drifter", meaning: "New member" },
  wanderer: { label: "Wanderer", meaning: "Site regular" },
  warden: { label: "Warden", meaning: "Moderator" },
  archon: { label: "Archon", meaning: "Admin" },
};
export function isSiteRank(r: unknown): r is SiteRank {
  return typeof r === "string" && (SITE_RANKS as readonly string[]).includes(r);
}
export type ExtraRank = (typeof EXTRA_RANKS)[number];
export type Rank = (typeof PRIMARY_RANKS)[number];

type RankHolder = { role?: string | null; extra_ranks?: string[] | null } | null | undefined;

export function isAdminRank(role: string | null | undefined): boolean {
  return role === "archon" || role === "warden";
}

/** Does this person hold `rank`, as primary, as an extra rank, or by being archon? */
export function hasRank(p: RankHolder, rank: Rank): boolean {
  if (!p) return false;
  if (p.role === "archon") return true;
  if (p.role === rank) return true;
  return (p.extra_ranks ?? []).includes(rank);
}

/** Every rank the person holds, primary first (for badges and the rank editor). */
export function heldRanks(p: RankHolder): Rank[] {
  if (!p) return [];
  const primary = (p.role ?? "drifter") as Rank;
  const extras = (p.extra_ranks ?? []).filter((r) => r !== primary) as Rank[];
  return [primary, ...extras];
}

/** Merchant abilities: manage inventory and a shop. Merchant rank, archon, or the seller tags. */
export function canSell(p: (RankHolder & { is_marketplace?: boolean | null; is_festdash_vendor?: boolean | null }) | null | undefined): boolean {
  return !!p && (!!p.is_marketplace || !!p.is_festdash_vendor || hasRank(p, "merchant") || p.role === "warden");
}

/** May `editor` change `target`'s extra ranks? */
export function canEditRanks(
  editor: (RankHolder & { id?: string; is_site_moderator?: boolean | null }) | null | undefined,
  target: (RankHolder & { id?: string }) | null | undefined,
): boolean {
  if (!editor || !target) return false;
  if (editor.role === "archon") return true;
  if (editor.role === "warden") return target.role !== "archon";
  // A moderator never edits their own ranks (Promoter would pay them), nor an admin's.
  return !!editor.is_site_moderator && !isAdminRank(target.role ?? null) && !!editor.id && editor.id !== target.id;
}
