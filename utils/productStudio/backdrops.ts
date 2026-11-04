/**
 * Backdrops for studio product photos — the only colours offered, like
 * ACCENT_CHOICES for shop accents. Each is a soft top→bottom gradient chosen to
 * sit behind a product without competing with it; dark products read on the
 * light ones and bright ones on the dark ones. Add one here, never inline.
 */
export type Backdrop = {
  id: string;
  label: string;
  /** Top and bottom colours, 0–255 RGB. */
  top: [number, number, number];
  bottom: [number, number, number];
};

export const BACKDROPS: Backdrop[] = [
  { id: "studio", label: "Studio white", top: [250, 250, 248], bottom: [222, 222, 218] },
  { id: "sand", label: "Sand", top: [242, 226, 200], bottom: [205, 170, 120] },
  { id: "sky", label: "Sky", top: [214, 232, 250], bottom: [120, 160, 215] },
  { id: "blush", label: "Blush", top: [255, 214, 224], bottom: [232, 120, 160] },
  { id: "mint", label: "Mint", top: [220, 245, 230], bottom: [120, 196, 160] },
  { id: "sunset", label: "Sunset", top: [255, 220, 170], bottom: [240, 130, 90] },
  { id: "lavender", label: "Lavender", top: [232, 222, 250], bottom: [150, 125, 210] },
  { id: "teal", label: "Deep teal", top: [40, 96, 92], bottom: [14, 40, 48] },
  { id: "night", label: "Night", top: [52, 52, 64], bottom: [12, 12, 16] },
];

export const DEFAULT_BACKDROP = "studio";

export function backdropById(id: string | undefined): Backdrop {
  return BACKDROPS.find((b) => b.id === id) ?? BACKDROPS[0];
}

/** CSS for a swatch / preview of the backdrop. */
export function backdropCss(b: Backdrop): string {
  return `linear-gradient(180deg, rgb(${b.top.join(",")}), rgb(${b.bottom.join(",")}))`;
}
