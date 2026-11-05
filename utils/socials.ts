/**
 * NorthEDM's own social accounts — the one place they are written. Shown by
 * `JoinUsOnline` on forms, pop-ups and confirmation screens ("Join us Online
 * for quick responses and updates!", owner 2026-11-05). A blank link hides its
 * button; with both blank the block isn't drawn at all, so a wrong or missing
 * address never sends anyone to someone else's page.
 */
export const NORTHEDM_SOCIALS: { facebook: string | null; instagram: string | null } = {
  facebook: "https://www.facebook.com/share/1VRDNqLM6V/", // owner, 2026-11-05
  instagram: null,
};
