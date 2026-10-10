/**
 * The accent colours a vendor or store operator may pick for their own pages.
 *
 * A fixed list rather than a free colour picker, because the accent is used in
 * two places that pull in opposite directions: as TEXT on the near-black page
 * (prices, labels) and as a BACKGROUND behind black button text (Add,
 * Checkout). A dark colour fails the first, a pale one is fine, and the free
 * picker let an owner choose something that made their own prices unreadable.
 *
 * Every entry below clears WCAG AA (4.5:1) both ways, measured against
 * #0a0a0a and #000000. Adding one? Check both numbers first — the ratios are in
 * the comments so the next person can see what "passes" means here.
 */
export const ACCENT_CHOICES = [
  { hex: "#39FF14", name: "Neon green" },      // 14.6 / 15.5 — NorthEDM default
  { hex: "#9F7AEA", name: "Deep amethyst" },   //  6.1 /  6.4
  { hex: "#A78BFA", name: "Lavender" },        //  7.3 /  7.7
  { hex: "#C4B5FD", name: "Pale lavender" },   // 10.7 / 11.4
  { hex: "#B48EAD", name: "Dusty mauve" },     //  7.0 /  7.4
  { hex: "#9CA3AF", name: "Smoke grey" },      //  7.8 /  8.3
  { hex: "#00D4FF", name: "Electric blue" },   // 11.2 / 11.9
  { hex: "#3AFFD4", name: "Aqua" },            // 15.5 / 16.4
  { hex: "#FB923C", name: "Ember" },           //  8.8 /  9.3
] as const;

export const DEFAULT_ACCENT = "#39FF14";

export function isAccentChoice(hex: unknown): hex is string {
  const h = String(hex ?? "").toUpperCase();
  return ACCENT_CHOICES.some((c) => c.hex === h);
}

/** A stored accent, or the default when it's missing or malformed. */
export function accentOr(hex: string | null | undefined, fallback = DEFAULT_ACCENT): string {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex ?? "")) ? (hex as string) : fallback;
}
