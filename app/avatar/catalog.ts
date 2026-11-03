// Avatar parts catalog, v2 (2026-11-03). Pure module — imported by the builder
// UI (client) and the purchase route (server, the price authority).
//
// A head-and-shoulders portrait drawn in a 256×256 space with real features:
// face shape, skin tone with shading, almond eyes with an iris colour, brows,
// nose, lips, hair in a chosen colour (back layer behind the head, front layer
// over it), facial hair, eyewear, earrings, headwear, neckwear, a top in a
// chosen colour, and a backdrop. Items are functions of the palette so one hair
// style serves every hair colour.
//
// Config shape: { v: 2, parts: { slot: itemId }, colors: { skin, hair, eyes, top, hat, lips } }.
// Old v1 configs ({ slot: itemId } only) are migrated by normalizeConfig().

export type Slot =
  | "background" | "face" | "extras" | "eyes" | "brows" | "nose" | "mouth"
  | "hair" | "facial" | "glasses" | "earrings" | "hat" | "neck" | "top";

export const SLOTS: Slot[] = [
  "face", "eyes", "brows", "nose", "mouth", "hair", "facial", "glasses", "earrings", "hat", "neck", "top", "extras", "background",
];

export const SLOT_LABELS: Record<Slot, string> = {
  face: "Face & skin", eyes: "Eyes", brows: "Brows", nose: "Nose", mouth: "Mouth", hair: "Hair", facial: "Facial hair",
  glasses: "Eyewear", earrings: "Earrings", hat: "Headwear", neck: "Neckwear", top: "Top", extras: "Extras", background: "Backdrop",
};

export type ColorSlot = "skin" | "hair" | "eyes" | "top" | "hat" | "lips";
export type Colors = Record<ColorSlot, string>;

/** Which colour swatch row a slot shows in the builder. */
export const SLOT_COLOR: Partial<Record<Slot, ColorSlot>> = {
  face: "skin", eyes: "eyes", hair: "hair", facial: "hair", brows: "hair", top: "top", hat: "hat", mouth: "lips",
};

export const COLOR_OPTIONS: Record<ColorSlot, { id: string; name: string; hex: string }[]> = {
  skin: [
    { id: "porcelain", name: "Porcelain", hex: "#f7e4d3" }, { id: "ivory", name: "Ivory", hex: "#f1d6bf" },
    { id: "sand", name: "Sand", hex: "#e8c4a0" }, { id: "beige", name: "Beige", hex: "#dfb08c" },
    { id: "honey", name: "Honey", hex: "#d49c74" }, { id: "caramel", name: "Caramel", hex: "#c48760" },
    { id: "amber", name: "Amber", hex: "#b3734f" }, { id: "bronze", name: "Bronze", hex: "#a0603f" },
    { id: "sienna", name: "Sienna", hex: "#8a5235" }, { id: "chestnut", name: "Chestnut", hex: "#74432b" },
    { id: "umber", name: "Umber", hex: "#5e3622" }, { id: "cocoa", name: "Cocoa", hex: "#4a2a1b" },
    { id: "espresso", name: "Espresso", hex: "#3a2016" }, { id: "ebony", name: "Ebony", hex: "#2b1811" },
  ],
  hair: [
    { id: "black", name: "Black", hex: "#1a1416" }, { id: "darkbrown", name: "Dark brown", hex: "#3b2a21" },
    { id: "brown", name: "Brown", hex: "#5a3e2b" }, { id: "chestnut", name: "Chestnut", hex: "#7a4f32" },
    { id: "lightbrown", name: "Light brown", hex: "#9a7352" }, { id: "auburn", name: "Auburn", hex: "#8a3b1f" },
    { id: "ginger", name: "Ginger", hex: "#c2602a" }, { id: "blonde", name: "Blonde", hex: "#d9b268" },
    { id: "platinum", name: "Platinum", hex: "#ece2c8" }, { id: "grey", name: "Grey", hex: "#9a9a9a" },
    { id: "white", name: "White", hex: "#f0eee9" }, { id: "pink", name: "Pink", hex: "#ff6fb5" },
    { id: "blue", name: "Blue", hex: "#3b82f6" }, { id: "green", name: "Green", hex: "#3ddc5a" },
    { id: "purple", name: "Purple", hex: "#a855f7" }, { id: "teal", name: "Teal", hex: "#2dd4bf" },
  ],
  eyes: [
    { id: "dark", name: "Dark brown", hex: "#2a1b14" }, { id: "brown", name: "Brown", hex: "#5a3a26" },
    { id: "hazel", name: "Hazel", hex: "#8a6a2f" }, { id: "amber", name: "Amber", hex: "#b7803a" },
    { id: "green", name: "Green", hex: "#3f7d4e" }, { id: "blue", name: "Blue", hex: "#3b7dd8" },
    { id: "grey", name: "Grey", hex: "#7f8c99" }, { id: "violet", name: "Violet", hex: "#7c5cd6" },
  ],
  top: [
    { id: "black", name: "Black", hex: "#17171a" }, { id: "charcoal", name: "Charcoal", hex: "#3a3a40" },
    { id: "white", name: "White", hex: "#ececec" }, { id: "cream", name: "Cream", hex: "#e9dcc3" },
    { id: "red", name: "Red", hex: "#c0392b" }, { id: "orange", name: "Orange", hex: "#e8742a" },
    { id: "yellow", name: "Yellow", hex: "#e3c23c" }, { id: "green", name: "Forest", hex: "#2f6b3a" },
    { id: "teal", name: "Teal", hex: "#1f8a8a" }, { id: "blue", name: "Blue", hex: "#2b5fb3" },
    { id: "navy", name: "Navy", hex: "#1e2a4a" }, { id: "purple", name: "Purple", hex: "#6d3fb3" },
    { id: "pink", name: "Pink", hex: "#e2608f" }, { id: "brown", name: "Brown", hex: "#6b4a32" },
    { id: "neon", name: "NorthEDM green", hex: "#39FF14" },
  ],
  hat: [
    { id: "black", name: "Black", hex: "#1b1b1f" }, { id: "grey", name: "Grey", hex: "#6b6b72" },
    { id: "white", name: "White", hex: "#f0f0f0" }, { id: "red", name: "Red", hex: "#b7332a" },
    { id: "orange", name: "Orange", hex: "#e07b2a" }, { id: "olive", name: "Olive", hex: "#5f6b3a" },
    { id: "green", name: "Green", hex: "#2f7d4a" }, { id: "blue", name: "Blue", hex: "#2f5fa8" },
    { id: "purple", name: "Purple", hex: "#6a3fa8" }, { id: "pink", name: "Pink", hex: "#e06aa0" },
    { id: "tan", name: "Tan", hex: "#c9a46a" }, { id: "brown", name: "Brown", hex: "#5a3c28" },
    { id: "gold", name: "Gold", hex: "#e2b53a" },
  ],
  lips: [
    { id: "natural", name: "Natural", hex: "" }, { id: "rose", name: "Rose", hex: "#c86a7a" },
    { id: "red", name: "Red", hex: "#c0233a" }, { id: "berry", name: "Berry", hex: "#8a2a5a" },
    { id: "nude", name: "Nude", hex: "#c9937e" }, { id: "black", name: "Black", hex: "#1a1416" },
  ],
};

export const DEFAULT_COLORS: Colors = { skin: "sand", hair: "darkbrown", eyes: "brown", top: "charcoal", hat: "black", lips: "natural" };

// ---- colour helpers ---------------------------------------------------

function hexOf(slot: ColorSlot, id: string): string {
  return COLOR_OPTIONS[slot].find((c) => c.id === id)?.hex ?? COLOR_OPTIONS[slot].find((c) => c.id === DEFAULT_COLORS[slot])!.hex;
}
export function shade(hex: string, amt: number): string {
  // amt in [-1, 1]: negative darkens, positive lightens toward white.
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
type P = { skin: string; hair: string; eyes: string; top: string; hat: string; lips: string };
function palette(c: Colors): P {
  const skin = hexOf("skin", c.skin);
  const lipsId = c.lips in { natural: 1 } ? "natural" : c.lips;
  const lips = lipsId === "natural" ? shade(skin, -0.32) : hexOf("lips", lipsId) || shade(skin, -0.32);
  return { skin, hair: hexOf("hair", c.hair), eyes: hexOf("eyes", c.eyes), top: hexOf("top", c.top), hat: hexOf("hat", c.hat), lips };
}

// ---- items --------------------------------------------------------------

export type AvatarItem = {
  id: string;
  name: string;
  slot: Slot;
  priceCents: number;           // 0 = free for everyone
  svg: (p: P) => string;        // front layer (slot z)
  back?: (p: P) => string;      // behind the head (long hair, hoods)
  hidesHair?: boolean;          // headwraps etc. — hair front layer is skipped
};

const Z: Record<Slot, number> = {
  background: 0, top: 6, neck: 7, face: 10, extras: 14, eyes: 20, brows: 22, nose: 24, mouth: 26, facial: 28, earrings: 30, hair: 40, glasses: 46, hat: 50,
};
const HAIR_BACK_Z = 4;

// Geometry shared by the parts. Head centre (128, 114); chin ≈ 184; neck to 200; shoulders from 186.
const FACE: Record<string, string> = {
  oval:   "M128 46 C168 46 186 82 186 118 C186 158 160 186 128 186 C96 186 70 158 70 118 C70 82 88 46 128 46 Z",
  round:  "M128 48 C172 48 190 86 190 120 C190 156 164 186 128 186 C92 186 66 156 66 120 C66 86 84 48 128 48 Z",
  square: "M128 48 C168 48 184 76 184 112 C184 150 176 180 150 186 L106 186 C80 180 72 150 72 112 C72 76 88 48 128 48 Z",
  heart:  "M128 46 C172 46 190 82 188 116 C186 150 156 178 134 188 L122 188 C100 178 70 150 68 116 C66 82 84 46 128 46 Z",
  long:   "M128 40 C164 40 182 78 182 118 C182 160 158 190 128 190 C98 190 74 160 74 118 C74 78 92 40 128 40 Z",
  diamond:"M128 46 C160 46 184 86 186 118 C182 152 158 184 128 188 C98 184 74 152 70 118 C72 86 96 46 128 46 Z",
};
function head(shape: string, p: P): string {
  const dark = shade(p.skin, -0.22), ear = shade(p.skin, -0.12);
  return `<defs><radialGradient id="skn" cx="0.45" cy="0.35" r="0.75"><stop offset="0" stop-color="${shade(p.skin, 0.08)}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs>
  <rect x="110" y="156" width="36" height="40" rx="10" fill="${shade(p.skin, -0.16)}"/>
  <ellipse cx="70" cy="122" rx="9" ry="13" fill="${ear}"/><ellipse cx="186" cy="122" rx="9" ry="13" fill="${ear}"/>
  <path d="M67 118 q3 8 3 12" fill="none" stroke="${dark}" stroke-width="1.5" opacity=".6"/><path d="M189 118 q-3 8 -3 12" fill="none" stroke="${dark}" stroke-width="1.5" opacity=".6"/>
  <path d="${FACE[shape]}" fill="url(#skn)"/>
  <path d="M100 176 Q128 194 156 176" fill="none" stroke="${dark}" stroke-width="2" opacity=".25"/>`;
}
function torso(p: P, collar: string): string {
  const d = shade(p.top, -0.25), l = shade(p.top, 0.1);
  return `<defs><linearGradient id="tp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${l}"/><stop offset="1" stop-color="${d}"/></linearGradient></defs>
  <path d="M22 256 V232 Q24 198 72 188 L104 180 Q128 196 152 180 L184 188 Q232 198 234 232 V256 Z" fill="url(#tp)"/>${collar}`;
}
function eye(cx: number, shape: string, p: P): string {
  const lid = shade(p.skin, -0.4), iris = p.eyes;
  const base = (whites: string) => `${whites}<circle cx="${cx}" cy="117" r="6.3" fill="${iris}"/><circle cx="${cx}" cy="117" r="6.3" fill="none" stroke="${shade(iris, -0.35)}" stroke-width="1"/><circle cx="${cx}" cy="117" r="3" fill="#120c0a"/><circle cx="${cx - 2}" cy="114.5" r="1.6" fill="#fff" opacity=".9"/>`;
  const W: Record<string, string> = {
    almond: `<path d="M${cx - 13} 117 Q${cx} 104 ${cx + 13} 117 Q${cx} 128 ${cx - 13} 117 Z" fill="#fbf7f2"/>`,
    round:  `<ellipse cx="${cx}" cy="117" rx="11.5" ry="10" fill="#fbf7f2"/>`,
    hooded: `<path d="M${cx - 13} 118 Q${cx} 108 ${cx + 13} 118 Q${cx} 127 ${cx - 13} 118 Z" fill="#fbf7f2"/>`,
    narrow: `<path d="M${cx - 13} 117 Q${cx} 109 ${cx + 13} 117 Q${cx} 124 ${cx - 13} 117 Z" fill="#fbf7f2"/>`,
    upturn: `<path d="M${cx - 13} 119 Q${cx} 104 ${cx + 13} 114 Q${cx} 128 ${cx - 13} 119 Z" fill="#fbf7f2"/>`,
    down:   `<path d="M${cx - 13} 114 Q${cx} 104 ${cx + 13} 119 Q${cx} 128 ${cx - 13} 114 Z" fill="#fbf7f2"/>`,
    wide:   `<ellipse cx="${cx}" cy="117" rx="13" ry="11" fill="#fbf7f2"/>`,
  };
  const lash: Record<string, string> = {
    almond: `<path d="M${cx - 13} 117 Q${cx} 103 ${cx + 13} 117" fill="none" stroke="${lid}" stroke-width="2.4" stroke-linecap="round"/>`,
    round:  `<path d="M${cx - 11.5} 117 Q${cx} 105 ${cx + 11.5} 117" fill="none" stroke="${lid}" stroke-width="2.4" stroke-linecap="round"/>`,
    hooded: `<path d="M${cx - 14} 118 Q${cx} 106 ${cx + 14} 118" fill="none" stroke="${lid}" stroke-width="2.6" stroke-linecap="round"/><path d="M${cx - 12} 112 Q${cx} 104 ${cx + 12} 112" fill="none" stroke="${lid}" stroke-width="1.2" opacity=".5"/>`,
    narrow: `<path d="M${cx - 13} 117 Q${cx} 108 ${cx + 13} 117" fill="none" stroke="${lid}" stroke-width="2.4" stroke-linecap="round"/>`,
    upturn: `<path d="M${cx - 13} 119 Q${cx} 103 ${cx + 13} 114" fill="none" stroke="${lid}" stroke-width="2.4" stroke-linecap="round"/>`,
    down:   `<path d="M${cx - 13} 114 Q${cx} 103 ${cx + 13} 119" fill="none" stroke="${lid}" stroke-width="2.4" stroke-linecap="round"/>`,
    wide:   `<path d="M${cx - 13} 117 Q${cx} 104 ${cx + 13} 117" fill="none" stroke="${lid}" stroke-width="2.4" stroke-linecap="round"/>`,
  };
  const clipId = `ec${cx}${shape}`;
  const whites = W[shape] ?? W.almond;
  return `<defs><clipPath id="${clipId}">${whites}</clipPath></defs>${whites}<g clip-path="url(#${clipId})">${base("")}</g>${lash[shape] ?? lash.almond}`;
}
function eyes(shape: string) { return (p: P) => eye(106, shape, p) + eye(150, shape, p); }
function closedEyes(p: P) {
  const lid = shade(p.skin, -0.4);
  return `<path d="M93 118 Q106 126 119 118" fill="none" stroke="${lid}" stroke-width="2.6" stroke-linecap="round"/><path d="M137 118 Q150 126 163 118" fill="none" stroke="${lid}" stroke-width="2.6" stroke-linecap="round"/>`;
}
function brows(kind: string) {
  return (p: P) => {
    const c = shade(p.hair, -0.1);
    const B: Record<string, string> = {
      soft:    `<path d="M92 101 Q106 94 120 100" stroke-width="3.2"/><path d="M136 100 Q150 94 164 101" stroke-width="3.2"/>`,
      arched:  `<path d="M92 103 Q104 90 121 99" stroke-width="3.4"/><path d="M135 99 Q152 90 164 103" stroke-width="3.4"/>`,
      straight:`<path d="M92 100 L120 99" stroke-width="3.6"/><path d="M136 99 L164 100" stroke-width="3.6"/>`,
      thick:   `<path d="M91 102 Q106 92 121 100" stroke-width="5.2"/><path d="M135 100 Q150 92 165 102" stroke-width="5.2"/>`,
      thin:    `<path d="M93 101 Q106 95 119 100" stroke-width="2"/><path d="M137 100 Q150 95 163 101" stroke-width="2"/>`,
      angled:  `<path d="M92 98 Q108 97 121 103" stroke-width="3.6"/><path d="M135 103 Q148 97 164 98" stroke-width="3.6"/>`,
      slit:    `<path d="M92 101 Q106 94 120 100" stroke-width="3.4"/><path d="M136 100 Q150 94 164 101" stroke-width="3.4"/><path d="M152 93 L155 105" stroke="${p.skin}" stroke-width="2.2"/>`,
    };
    return `<g fill="none" stroke="${c}" stroke-linecap="round">${B[kind] ?? B.soft}</g>`;
  };
}
function nose(kind: string) {
  return (p: P) => {
    const d = shade(p.skin, -0.3), s = shade(p.skin, -0.14);
    const N: Record<string, string> = {
      soft:     `<path d="M124 124 Q120 136 118 140 Q124 146 132 144 Q138 142 136 138" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
      straight: `<path d="M126 118 L122 140 Q128 146 136 141" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round" opacity=".75"/>`,
      button:   `<ellipse cx="128" cy="141" rx="8" ry="5.5" fill="${s}" opacity=".9"/><path d="M121 143 q3 3 6 1 M135 143 q-3 3 -6 1" fill="none" stroke="${d}" stroke-width="1.6" opacity=".6"/>`,
      wide:     `<path d="M118 140 Q122 148 128 146 Q134 148 138 140" fill="none" stroke="${d}" stroke-width="2.2" stroke-linecap="round" opacity=".75"/><path d="M125 120 L121 136" fill="none" stroke="${d}" stroke-width="1.5" opacity=".4"/>`,
      pointed:  `<path d="M125 118 L120 142 L130 145 L136 140" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`,
      aquiline: `<path d="M126 116 Q134 128 132 140 Q128 146 120 142" fill="none" stroke="${d}" stroke-width="2.1" stroke-linecap="round" opacity=".75"/>`,
      flat:     `<path d="M119 141 Q128 149 137 141" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
    };
    return N[kind] ?? N.soft;
  };
}
function mouth(kind: string) {
  return (p: P) => {
    const lip = p.lips, dk = shade(lip, -0.35), line = shade(p.skin, -0.45);
    const M: Record<string, string> = {
      smile:  `<path d="M110 160 Q128 176 146 160" fill="none" stroke="${line}" stroke-width="2.6" stroke-linecap="round"/><path d="M112 160 Q128 170 144 160 Q128 164 112 160 Z" fill="${lip}" opacity=".8"/>`,
      teeth:  `<path d="M108 159 Q128 182 148 159 Z" fill="${dk}"/><path d="M112 161 Q128 170 144 161 Z" fill="#fff"/><path d="M108 159 Q128 158 148 159" fill="none" stroke="${line}" stroke-width="2" stroke-linecap="round"/>`,
      soft:   `<path d="M112 162 Q128 168 144 162" fill="none" stroke="${line}" stroke-width="2.4" stroke-linecap="round"/><path d="M114 161 Q128 156 142 161 Q128 166 114 161 Z" fill="${lip}" opacity=".85"/>`,
      neutral:`<path d="M113 162 H143" stroke="${line}" stroke-width="2.4" stroke-linecap="round"/><path d="M115 161 Q128 156 141 161 Q128 165 115 161 Z" fill="${lip}" opacity=".8"/>`,
      smirk:  `<path d="M112 163 Q128 168 146 158" fill="none" stroke="${line}" stroke-width="2.6" stroke-linecap="round"/><path d="M114 162 Q128 158 144 159 Q128 166 114 162 Z" fill="${lip}" opacity=".8"/>`,
      laugh:  `<path d="M106 157 Q128 190 150 157 Z" fill="${dk}"/><path d="M110 159 Q128 168 146 159 Z" fill="#fff"/><path d="M114 176 Q128 184 142 176 Q128 172 114 176Z" fill="#d9646f"/>`,
      pout:   `<path d="M114 160 Q121 153 128 158 Q135 153 142 160 Q135 170 128 170 Q121 170 114 160 Z" fill="${lip}"/><path d="M114 160 Q128 164 142 160" fill="none" stroke="${dk}" stroke-width="1.2"/>`,
      full:   `<path d="M112 160 Q120 152 128 157 Q136 152 144 160 Q136 172 128 172 Q120 172 112 160 Z" fill="${lip}"/><path d="M112 160 Q128 165 144 160" fill="none" stroke="${dk}" stroke-width="1.3"/><path d="M122 163 Q128 167 134 163" fill="none" stroke="#fff" stroke-width="1" opacity=".5"/>`,
      grin:   `<path d="M108 158 Q128 180 148 158 Q128 170 108 158 Z" fill="${dk}"/><path d="M112 160 Q128 169 144 160 Z" fill="#fff"/>`,
      open:   `<ellipse cx="128" cy="164" rx="9" ry="7" fill="${dk}"/><path d="M121 161 Q128 158 135 161" fill="none" stroke="#fff" stroke-width="2"/>`,
      tongue: `<path d="M108 158 Q128 182 148 158 Z" fill="${dk}"/><path d="M120 168 Q128 184 138 168 Z" fill="#e0567a"/>`,
    };
    return M[kind] ?? M.smile;
  };
}
function hairStyle(front: (c: string, d: string, l: string) => string, back?: (c: string, d: string) => string): Pick<AvatarItem, "svg" | "back"> {
  return {
    svg: (p) => front(p.hair, shade(p.hair, -0.25), shade(p.hair, 0.18)),
    back: back ? (p) => back(p.hair, shade(p.hair, -0.25)) : undefined,
  };
}
const CROWN = "M72 112 C70 70 94 46 128 46 C162 46 186 70 184 112"; // hairline arc across the top of the head
function hatColor(p: P) { return { c: p.hat, d: shade(p.hat, -0.28), l: shade(p.hat, 0.15) }; }
function facialHair(kind: string) {
  return (p: P) => {
    const c = shade(p.hair, -0.05), c2 = shade(p.hair, -0.2);
    const F: Record<string, string> = {
      stubble: `<path d="M80 134 Q86 184 128 190 Q170 184 176 134 Q168 176 128 180 Q88 176 80 134 Z" fill="${c}" opacity=".28"/>`,
      mustache:`<path d="M108 152 Q118 146 128 152 Q138 146 148 152 Q140 160 128 156 Q116 160 108 152 Z" fill="${c}"/>`,
      goatee:  `<path d="M116 170 Q128 196 140 170 Q134 182 128 182 Q122 182 116 170 Z" fill="${c}"/><path d="M110 152 Q119 147 128 152 Q137 147 146 152 Q138 159 128 156 Q118 159 110 152 Z" fill="${c}"/>`,
      chin:    `<path d="M78 128 Q82 180 128 192 Q174 180 178 128 Q172 170 128 180 Q84 170 78 128 Z" fill="${c}" opacity=".85"/>`,
      full:    `<path d="M76 124 Q80 196 128 204 Q176 196 180 124 Q168 176 128 182 Q88 176 76 124 Z" fill="${c}"/><path d="M110 152 Q119 147 128 152 Q137 147 146 152 Q138 159 128 156 Q118 159 110 152 Z" fill="${c2}"/>`,
      long:    `<path d="M76 124 Q78 210 128 236 Q178 210 180 124 Q168 180 128 186 Q88 180 76 124 Z" fill="${c}"/><path d="M110 152 Q119 147 128 152 Q137 147 146 152 Q138 159 128 156 Q118 159 110 152 Z" fill="${c2}"/>`,
      soul:    `<path d="M122 170 Q128 180 134 170 Q128 176 122 170 Z" fill="${c}"/>`,
      handlebar:`<path d="M104 150 Q116 144 128 152 Q140 144 152 150 Q160 146 156 158 Q146 160 140 156 Q128 158 116 156 Q110 160 100 158 Q96 146 104 150 Z" fill="${c}"/>`,
      neon:    `<path d="M76 124 Q80 196 128 204 Q176 196 180 124 Q168 176 128 182 Q88 176 76 124 Z" fill="#123a1a"/><path d="M76 124 Q80 196 128 204 Q176 196 180 124" fill="none" stroke="#39FF14" stroke-width="2" opacity=".7"/>`,
    };
    return F[kind] ?? "";
  };
}
function glasses(kind: string) {
  return (p: P) => {
    const f = shade(p.hair, -0.3);
    const G: Record<string, string> = {
      round:  `<g fill="none" stroke="${f}" stroke-width="2.6"><circle cx="106" cy="117" r="15"/><circle cx="150" cy="117" r="15"/><path d="M121 117 H135 M91 116 L74 112 M165 116 L182 112"/></g>`,
      square: `<g fill="none" stroke="${f}" stroke-width="2.6"><rect x="90" y="105" width="32" height="24" rx="5"/><rect x="134" y="105" width="32" height="24" rx="5"/><path d="M122 115 H134 M90 114 L74 111 M166 114 L182 111"/></g>`,
      aviator:`<g><path d="M90 108 Q106 104 122 108 L120 126 Q106 134 92 126 Z" fill="#6b4a2a" opacity=".55"/><path d="M134 108 Q150 104 166 108 L164 126 Q150 134 136 126 Z" fill="#6b4a2a" opacity=".55"/><g fill="none" stroke="#c9b037" stroke-width="2"><path d="M90 108 Q106 104 122 108 L120 126 Q106 134 92 126 Z M134 108 Q150 104 166 108 L164 126 Q150 134 136 126 Z M122 110 H134 M90 110 L74 112 M166 110 L182 112"/></g></g>`,
      cateye: `<g fill="none" stroke="${f}" stroke-width="2.8"><path d="M90 112 Q106 128 122 116 L126 106 Q110 112 90 104 Z"/><path d="M166 112 Q150 128 134 116 L130 106 Q146 112 166 104 Z"/><path d="M90 108 L74 110 M166 108 L182 110"/></g>`,
      shades: `<g><rect x="88" y="106" width="34" height="23" rx="7" fill="#0f0f14"/><rect x="134" y="106" width="34" height="23" rx="7" fill="#0f0f14"/><path d="M122 112 H134 M88 112 L74 110 M168 112 L182 110" stroke="#0f0f14" stroke-width="4"/><path d="M92 110 l22 5" stroke="#fff" stroke-width="1.5" opacity=".35"/></g>`,
      visor:  `<g><rect x="80" y="106" width="96" height="20" rx="10" fill="#0a0a12"/><rect x="86" y="114" width="84" height="4" rx="2" fill="#39FF14"/></g>`,
      heart:  `<g fill="#FF3EA5" fill-opacity=".45" stroke="#CC00FF" stroke-width="1.6"><path transform="translate(92 105) scale(1.1)" d="M13 7 C13 2 5 2 5 8 C5 13 13 16 13 20 C13 16 21 13 21 8 C21 2 13 2 13 7 Z"/><path transform="translate(136 105) scale(1.1)" d="M13 7 C13 2 5 2 5 8 C5 13 13 16 13 20 C13 16 21 13 21 8 C21 2 13 2 13 7 Z"/><path d="M122 115 H134" fill="none" stroke-width="2.4"/></g>`,
      glow:   `<g fill="none" stroke-linecap="round"><circle cx="106" cy="117" r="16" stroke="#39FF14" stroke-width="8" opacity=".3"/><circle cx="150" cy="117" r="16" stroke="#00D4FF" stroke-width="8" opacity=".3"/><circle cx="106" cy="117" r="16" stroke="#39FF14" stroke-width="3"/><circle cx="150" cy="117" r="16" stroke="#00D4FF" stroke-width="3"/><path d="M122 117 H134" stroke="#CC00FF" stroke-width="3"/></g>`,
      monocle:`<g fill="none" stroke="#c9b037" stroke-width="2.4"><circle cx="150" cy="117" r="14"/><path d="M158 129 Q170 150 160 176"/></g>`,
    };
    return G[kind] ?? "";
  };
}
function earrings(kind: string) {
  return (p: P) => {
    const gold = "#e2b53a", silver = "#d7dbe0";
    const E: Record<string, string> = {
      studs:  `<circle cx="70" cy="131" r="2.6" fill="${gold}"/><circle cx="186" cy="131" r="2.6" fill="${gold}"/>`,
      hoops:  `<circle cx="70" cy="138" r="6" fill="none" stroke="${gold}" stroke-width="2"/><circle cx="186" cy="138" r="6" fill="none" stroke="${gold}" stroke-width="2"/>`,
      bighoops:`<circle cx="70" cy="146" r="13" fill="none" stroke="${gold}" stroke-width="2.2"/><circle cx="186" cy="146" r="13" fill="none" stroke="${gold}" stroke-width="2.2"/>`,
      drops:  `<path d="M70 133 V142" stroke="${silver}" stroke-width="1.6"/><ellipse cx="70" cy="147" rx="3.5" ry="5" fill="#7dd3fc"/><path d="M186 133 V142" stroke="${silver}" stroke-width="1.6"/><ellipse cx="186" cy="147" rx="3.5" ry="5" fill="#7dd3fc"/>`,
      pearls: `<circle cx="70" cy="133" r="3.4" fill="#f3efe6"/><circle cx="186" cy="133" r="3.4" fill="#f3efe6"/>`,
      cross:  `<g stroke="${silver}" stroke-width="1.8"><path d="M70 133 V148 M66 138 H74 M186 133 V148 M182 138 H190"/></g>`,
      gauges: `<circle cx="70" cy="134" r="5" fill="#1a1416"/><circle cx="70" cy="134" r="5" fill="none" stroke="${silver}" stroke-width="1.5"/><circle cx="186" cy="134" r="5" fill="#1a1416"/><circle cx="186" cy="134" r="5" fill="none" stroke="${silver}" stroke-width="1.5"/>`,
      feather:`<path d="M70 133 V140 M70 140 Q62 156 68 170 Q76 156 70 140" stroke="#a855f7" stroke-width="1.6" fill="#c084fc"/><path d="M186 133 V140 M186 140 Q178 156 184 170 Q192 156 186 140" stroke="#22d3ee" stroke-width="1.6" fill="#67e8f9"/>`,
      neon:   `<circle cx="70" cy="140" r="7" fill="none" stroke="#39FF14" stroke-width="2.4"/><circle cx="186" cy="140" r="7" fill="none" stroke="#00D4FF" stroke-width="2.4"/>`,
    };
    return E[kind] ?? "";
  };
}
function neckwear(kind: string) {
  return (p: P) => {
    const gold = "#e2b53a", silver = "#d7dbe0";
    const N: Record<string, string> = {
      gold:    `<path d="M98 196 Q128 226 158 196" fill="none" stroke="${gold}" stroke-width="3.2" stroke-linecap="round"/>`,
      silver:  `<path d="M98 196 Q128 226 158 196" fill="none" stroke="${silver}" stroke-width="3" stroke-linecap="round"/>`,
      pendant: `<path d="M98 196 Q128 222 158 196" fill="none" stroke="${gold}" stroke-width="2"/><path d="M128 209 l6 7 l-6 9 l-6 -9 Z" fill="#7dd3fc" stroke="${gold}" stroke-width="1.2"/>`,
      pearls:  `${[0,1,2,3,4,5,6,7,8].map((i) => { const t = i / 8, u = 1 - t; const x = u*u*98 + 2*u*t*128 + t*t*158, y = u*u*196 + 2*u*t*230 + t*t*196; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#f3efe6" stroke="#cfc6b4" stroke-width=".6"/>`; }).join("")}`,
      kandi:   `${["#39FF14","#FF6FB5","#E8FF47","#7DD3FC","#CC00FF","#FF5C3A","#39FF14"].map((c, i) => { const t = i / 6, u = 1 - t; const x = u*u*96 + 2*u*t*128 + t*t*160, y = u*u*198 + 2*u*t*232 + t*t*198; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.4" fill="${c}"/>`; }).join("")}`,
      choker:  `<path d="M104 194 Q128 204 152 194" fill="none" stroke="#1a1416" stroke-width="5" stroke-linecap="round"/>`,
      glow:    `<g fill="none" stroke-linecap="round"><path d="M96 198 Q128 234 160 198" stroke="#00D4FF" stroke-width="9" opacity=".28"/><path d="M96 198 Q128 234 160 198" stroke="#00D4FF" stroke-width="3.5"/></g>`,
      scarf:   `<path d="M100 192 Q128 216 156 192 L160 206 Q128 232 96 206 Z" fill="${shade(p.top, 0.35)}"/><path d="M118 212 L112 250 L126 248 L128 216 Z" fill="${shade(p.top, 0.35)}"/>`,
      bowtie:  `<path d="M112 196 L128 204 L144 196 L144 214 L128 206 L112 214 Z" fill="#b7332a"/><rect x="124" y="200" width="8" height="10" rx="2" fill="#7a1f18"/>`,
      bandana: `<path d="M100 192 Q128 214 156 192 L154 204 Q128 222 102 204 Z" fill="#b7332a"/><g fill="#fff" opacity=".6"><circle cx="112" cy="201" r="1.6"/><circle cx="128" cy="207" r="1.6"/><circle cx="144" cy="201" r="1.6"/></g>`,
    };
    return N[kind] ?? "";
  };
}
function top(kind: string) {
  return (p: P) => {
    const c = p.top, d = shade(p.top, -0.3), l = shade(p.top, 0.25);
    const T: Record<string, string> = {
      tee:     torso(p, `<path d="M104 180 Q128 198 152 180 Q140 192 128 194 Q116 192 104 180 Z" fill="${d}" opacity=".5"/>`),
      vneck:   torso(p, `<path d="M104 180 L128 212 L152 180 Q128 196 104 180 Z" fill="${shade(p.skin, -0.16)}"/>`),
      hoodie:  torso(p, `<path d="M96 178 Q128 206 160 178 L176 190 Q128 226 80 190 Z" fill="${d}"/><path d="M118 214 V250 M138 214 V250" stroke="${l}" stroke-width="3" stroke-linecap="round"/>`),
      jacket:  torso(p, `<path d="M106 180 L96 256 H160 L150 180 Q128 196 106 180 Z" fill="${shade(c, -0.1)}"/><path d="M106 180 L80 196 L96 256 M150 180 L176 196 L160 256" fill="none" stroke="${d}" stroke-width="3"/><path d="M128 198 V256" stroke="${d}" stroke-width="2"/>`),
      buttonup:torso(p, `<path d="M112 180 L128 200 L144 180 L152 190 L128 212 L104 190 Z" fill="#f1f1f1"/><path d="M128 212 V256" stroke="${d}" stroke-width="2"/><circle cx="128" cy="224" r="1.8" fill="${d}"/><circle cx="128" cy="240" r="1.8" fill="${d}"/>`),
      tank:    `<defs><linearGradient id="tp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${l}"/><stop offset="1" stop-color="${d}"/></linearGradient></defs><path d="M22 256 V232 Q24 198 72 188 L104 180 Q128 196 152 180 L184 188 Q232 198 234 232 V256 Z" fill="${shade(p.skin, -0.1)}"/><path d="M92 256 V210 Q100 186 110 182 Q128 198 146 182 Q156 186 164 210 V256 Z" fill="url(#tp)"/>`,
      blouse:  torso(p, `<path d="M100 180 Q128 206 156 180 Q148 200 128 206 Q108 200 100 180 Z" fill="${shade(p.skin, -0.16)}"/><path d="M100 180 Q128 206 156 180" fill="none" stroke="${l}" stroke-width="2.5"/>`),
      turtle:  torso(p, `<rect x="104" y="170" width="48" height="26" rx="10" fill="${shade(c, -0.08)}"/><path d="M108 176 H148 M108 184 H148" stroke="${d}" stroke-width="1.5" opacity=".6"/>`),
      suit:    torso(p, `<path d="M110 180 L128 214 L146 180 L150 186 L128 232 L106 186 Z" fill="#f1f1f1"/><path d="M128 196 l6 8 l-6 22 l-6 -22 Z" fill="#8a2a5a"/><path d="M104 180 L84 200 L104 256 H152 L172 200 L152 180 L128 232 Z" fill="none" stroke="${d}" stroke-width="2.5"/>`),
      mesh:    torso(p, `<g stroke="${l}" stroke-width="1" opacity=".55"><path d="M40 210 L220 250 M40 230 L220 270 M40 250 L200 290 M90 190 L30 260 M130 190 L70 260 M170 190 L110 260 M210 200 L150 270"/></g><path d="M104 180 Q128 198 152 180 Q140 192 128 194 Q116 192 104 180 Z" fill="${d}" opacity=".6"/>`),
      jersey:  torso(p, `<path d="M104 180 L128 206 L152 180 Q128 196 104 180 Z" fill="${d}"/><text x="128" y="246" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="26" fill="${l}" opacity=".9">11</text>`),
      kimono:  torso(p, `<path d="M104 180 L92 256 H128 L128 212 Z" fill="${shade(c, 0.12)}"/><path d="M152 180 L164 256 H128 L128 212 Z" fill="${shade(c, -0.12)}"/><path d="M104 180 L128 212 L152 180" fill="none" stroke="${l}" stroke-width="3"/><rect x="60" y="222" width="136" height="14" fill="${shade(c, -0.45)}"/>`),
      dashiki: torso(p, `<path d="M106 180 Q128 198 150 180 L158 204 Q128 222 98 204 Z" fill="${shade(c, -0.2)}"/><g fill="none" stroke="${l}" stroke-width="2"><path d="M98 204 Q128 222 158 204 M104 214 Q128 230 152 214 M110 222 Q128 236 146 222"/><path d="M118 188 L128 198 L138 188 M114 196 L128 208 L142 196" /></g>`),
    };
    return T[kind] ?? T.tee;
  };
}
function hat(kind: string) {
  return (p: P) => {
    const { c, d, l } = hatColor(p);
    const H: Record<string, string> = {
      cap:     `<path d="M70 104 C74 62 182 62 186 104 Z" fill="${c}"/><path d="M70 104 Q128 94 186 104" fill="none" stroke="${d}" stroke-width="3"/><path d="M128 104 L210 112 Q212 122 196 120 L126 112 Z" fill="${d}"/><path d="M128 64 V100" stroke="${d}" stroke-width="2" opacity=".6"/>`,
      snapback:`<path d="M70 104 C74 62 182 62 186 104 Z" fill="${c}"/><path d="M70 104 Q128 94 186 104" fill="none" stroke="${d}" stroke-width="3"/><path d="M128 104 L46 112 Q44 122 60 120 L130 112 Z" fill="${d}"/><rect x="92" y="78" width="72" height="22" rx="4" fill="${l}"/>`,
      beanie:  `<path d="M66 110 C68 58 188 58 190 110 Z" fill="${c}"/><rect x="62" y="102" width="132" height="18" rx="7" fill="${d}"/><g stroke="${d}" stroke-width="2" opacity=".5"><path d="M96 70 V102 M112 62 V102 M128 60 V102 M144 62 V102 M160 70 V102"/></g>`,
      pom:     `<path d="M66 110 C68 58 188 58 190 110 Z" fill="${c}"/><rect x="62" y="102" width="132" height="18" rx="7" fill="${d}"/><circle cx="128" cy="54" r="13" fill="${l}"/>`,
      bucket:  `<path d="M78 100 C82 64 174 64 178 100 Z" fill="${c}"/><path d="M60 102 Q128 118 196 102 L200 114 Q128 132 56 114 Z" fill="${d}"/>`,
      cowboy:  `<path d="M86 100 C90 60 166 60 170 100 Z" fill="${c}"/><path d="M34 104 Q60 120 128 118 Q196 120 222 104 Q210 128 128 134 Q46 128 34 104 Z" fill="${d}"/><path d="M86 100 Q128 108 170 100" fill="none" stroke="#5a3c28" stroke-width="4"/>`,
      fedora:  `<path d="M84 102 C84 64 172 64 172 102 Z" fill="${c}"/><path d="M58 106 Q128 122 198 106 L200 112 Q128 128 56 112 Z" fill="${d}"/><path d="M84 100 Q128 108 172 100 L172 94 Q128 102 84 94 Z" fill="#1a1416"/>`,
      beret:   `<path d="M66 108 C58 70 150 50 182 76 C196 88 186 102 176 106 Z" fill="${c}"/><rect x="70" y="102" width="106" height="8" rx="4" fill="${d}"/><path d="M130 58 q6 -8 12 -2" stroke="${d}" stroke-width="3" fill="none"/>`,
      headwrap:`<path d="M64 150 C56 70 200 60 192 150 L186 118 C180 96 150 86 128 90 C104 86 76 96 70 118 Z" fill="${c}"/><path d="M72 118 Q128 104 184 118" fill="none" stroke="${d}" stroke-width="3"/><path d="M120 60 Q150 40 178 62 Q160 56 140 66 Q130 70 120 60 Z" fill="${l}"/>`,
      hijab:   `<path fill-rule="evenodd" d="M44 256 V222 Q46 160 68 116 C74 66 182 66 188 116 Q210 160 212 222 V256 Z M128 58 C162 58 178 90 178 120 C178 154 158 184 136 194 L120 194 C98 184 78 154 78 120 C78 90 94 58 128 58 Z" fill="${c}"/><path d="M78 120 C78 90 94 58 128 58 C162 58 178 90 178 120" fill="none" stroke="${d}" stroke-width="2.5" opacity=".6"/><path d="M188 116 Q212 160 212 200" fill="none" stroke="${d}" stroke-width="2" opacity=".5"/>`,
      durag:   `<path d="M70 110 C74 62 182 62 186 110 Z" fill="${c}"/><path d="M70 110 Q128 100 186 110" fill="none" stroke="${d}" stroke-width="3"/><path d="M180 104 Q214 130 206 186 Q200 150 176 118 Z" fill="${d}"/>`,
      turban:  `<path d="M66 112 C64 60 192 60 190 112 Z" fill="${c}"/><g fill="none" stroke="${d}" stroke-width="3"><path d="M70 100 Q128 66 186 100 M80 84 Q128 58 176 84 M66 112 Q128 92 190 112"/></g><circle cx="128" cy="78" r="5" fill="${l}"/>`,
      kufi:    `<path d="M78 104 C80 66 176 66 178 104 Z" fill="${c}"/><rect x="76" y="98" width="104" height="10" rx="3" fill="${d}"/><g stroke="${l}" stroke-width="1.5" opacity=".7"><path d="M92 80 L164 80 M96 90 L160 90"/></g>`,
      crown:   `<path d="M80 104 L90 64 L110 92 L128 54 L146 92 L166 64 L176 104 Z" fill="#E8C94A" stroke="#a88a12" stroke-width="2"/><rect x="80" y="100" width="96" height="10" fill="#d4b43a" stroke="#a88a12" stroke-width="1.5"/><circle cx="128" cy="70" r="4.5" fill="#e23b4a"/><circle cx="96" cy="82" r="3" fill="#3b7dd8"/><circle cx="160" cy="82" r="3" fill="#3b7dd8"/>`,
      tiara:   `<path d="M86 100 Q104 74 128 96 Q152 74 170 100" fill="none" stroke="#d7dbe0" stroke-width="3.5" stroke-linecap="round"/><path d="M128 96 L128 70" stroke="#d7dbe0" stroke-width="3"/><circle cx="128" cy="68" r="5" fill="#7dd3fc"/><circle cx="104" cy="82" r="3" fill="#f0abfc"/><circle cx="152" cy="82" r="3" fill="#f0abfc"/>`,
      flowers: `<path d="M70 108 Q128 92 186 108" fill="none" stroke="#3b7d3b" stroke-width="5"/>${[[82,104,"#FF6FB5"],[106,96,"#E8FF47"],[130,94,"#ffffff"],[154,96,"#7DD3FC"],[176,104,"#f0abfc"]].map(([x,y,col]) => [0,1,2,3,4].map((i) => { const a = (i*2*Math.PI)/5 - Math.PI/2; return `<circle cx="${(Number(x)+6.5*Math.cos(a)).toFixed(1)}" cy="${(Number(y)+6.5*Math.sin(a)).toFixed(1)}" r="4" fill="${col}"/>`; }).join("") + `<circle cx="${x}" cy="${y}" r="3" fill="#E8FF47"/>`).join("")}`,
      headband:`<path d="M70 100 Q128 86 186 100 L186 110 Q128 96 70 110 Z" fill="${c}"/>`,
      bandana: `<path d="M68 104 Q128 86 188 104 L188 118 Q128 100 68 118 Z" fill="${c}"/><path d="M68 108 l-16 -6 l6 16 Z" fill="${d}"/><g fill="#fff" opacity=".55"><circle cx="98" cy="106" r="2"/><circle cx="128" cy="100" r="2"/><circle cx="158" cy="106" r="2"/></g>`,
      halo:    `<g fill="none"><ellipse cx="128" cy="46" rx="50" ry="12" stroke="#00D4FF" stroke-width="10" opacity=".3"/><ellipse cx="128" cy="46" rx="50" ry="12" stroke="#00D4FF" stroke-width="4"/></g>`,
      horns:   `<path d="M84 90 Q70 60 90 48 Q84 72 100 92 Z" fill="#8a2a5a"/><path d="M172 90 Q186 60 166 48 Q172 72 156 92 Z" fill="#8a2a5a"/>`,
      hood:    `<path fill-rule="evenodd" d="M56 256 V200 Q52 84 128 66 Q204 84 200 200 V256 Z M128 92 C160 92 182 118 182 150 Q182 196 150 206 L106 206 Q74 196 74 150 C74 118 96 92 128 92 Z" fill="${c}"/><path d="M74 150 C74 118 96 92 128 92 C160 92 182 118 182 150" fill="none" stroke="${d}" stroke-width="2.5" opacity=".6"/>`,
    };
    return H[kind] ?? "";
  };
}
function extras(kind: string) {
  return (p: P) => {
    const d = shade(p.skin, -0.35);
    const X: Record<string, string> = {
      freckles: `<g fill="${d}" opacity=".55">${[[96,136],[104,142],[112,138],[100,148],[144,138],[152,142],[160,136],[156,148],[120,146],[136,146]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1.5"/>`).join("")}</g>`,
      blush:    `<ellipse cx="98" cy="140" rx="12" ry="7" fill="#e0567a" opacity=".22"/><ellipse cx="158" cy="140" rx="12" ry="7" fill="#e0567a" opacity=".22"/>`,
      mark:     `<circle cx="146" cy="150" r="2" fill="${d}"/>`,
      nosering: `<circle cx="136" cy="145" r="4" fill="none" stroke="#d7dbe0" stroke-width="1.6"/>`,
      septum:   `<path d="M123 146 Q128 154 133 146" fill="none" stroke="#d7dbe0" stroke-width="1.8"/>`,
      paint:    `<g stroke-width="4" stroke-linecap="round"><path d="M86 132 L108 128" stroke="#39FF14"/><path d="M88 140 L110 136" stroke="#00D4FF"/><path d="M148 128 L170 132" stroke="#CC00FF"/><path d="M146 136 L168 140" stroke="#E8FF47"/></g>`,
      glitter:  `<g fill="#fff">${[[92,128],[100,146],[156,130],[164,146],[112,150],[144,152],[88,140],[168,138]].map(([x,y]) => `<path d="M${x} ${y-3} L${x+1} ${y-1} L${x+3} ${y} L${x+1} ${y+1} L${x} ${y+3} L${x-1} ${y+1} L${x-3} ${y} L${x-1} ${y-1} Z" opacity=".9"/>`).join("")}</g>`,
      scar:     `<path d="M150 100 L158 126" stroke="${d}" stroke-width="2" stroke-linecap="round"/><g stroke="${d}" stroke-width="1.2"><path d="M149 108 L156 106 M152 116 L159 114"/></g>`,
      lashes:   `<g stroke="#120c0a" stroke-width="1.6" stroke-linecap="round"><path d="M93 112 L90 107 M97 109 L95 104 M159 112 L162 107 M155 109 L157 104"/></g>`,
    };
    return X[kind] ?? "";
  };
}
const bg = (fill: string) => () => `<rect width="256" height="256" fill="${fill}"/>`;

export const ITEMS: AvatarItem[] = [
  // Backdrops
  { id: "bg-void",   name: "Void",       slot: "background", priceCents: 0,   svg: bg("#0b0b0d") },
  { id: "bg-moss",   name: "Moss",       slot: "background", priceCents: 0,   svg: bg("#12241b") },
  { id: "bg-dusk",   name: "Dusk",       slot: "background", priceCents: 0,   svg: bg("#1a1430") },
  { id: "bg-ember",  name: "Ember",      slot: "background", priceCents: 0,   svg: bg("#26120c") },
  { id: "bg-tide",   name: "Tide",       slot: "background", priceCents: 0,   svg: bg("#0a1c24") },
  { id: "bg-slate",  name: "Slate",      slot: "background", priceCents: 0,   svg: bg("#2a2f36") },
  { id: "bg-sand",   name: "Warm sand",  slot: "background", priceCents: 0,   svg: bg("#d8c3a5") },
  { id: "bg-sky",    name: "Sky",        slot: "background", priceCents: 0,   svg: () => `<defs><linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient></defs><rect width="256" height="256" fill="url(#g-sky)"/>` },
  { id: "bg-aurora", name: "Aurora",     slot: "background", priceCents: 100, svg: () => `<defs><linearGradient id="g-aurora" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#39FF14"/><stop offset="55%" stop-color="#00D4FF"/><stop offset="100%" stop-color="#CC00FF"/></linearGradient></defs><rect width="256" height="256" fill="url(#g-aurora)"/><rect width="256" height="256" fill="#000" opacity="0.35"/>` },
  { id: "bg-grid",   name: "Neon grid",  slot: "background", priceCents: 150, svg: () => `<rect width="256" height="256" fill="#070b10"/><g stroke="#00D4FF" stroke-width="1" opacity="0.5"><path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256"/></g>` },
  { id: "bg-sunset", name: "Festival sunset", slot: "background", priceCents: 150, svg: () => `<defs><linearGradient id="g-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1055"/><stop offset=".55" stop-color="#e2608f"/><stop offset="1" stop-color="#f6ad55"/></linearGradient></defs><rect width="256" height="256" fill="url(#g-sun)"/><circle cx="128" cy="150" r="34" fill="#ffd166" opacity=".9"/>` },
  { id: "bg-stage",  name: "Stage lights", slot: "background", priceCents: 200, svg: () => `<rect width="256" height="256" fill="#06060a"/><g opacity=".55"><path d="M40 0 L10 256 L90 256 Z" fill="#CC00FF"/><path d="M128 0 L88 256 L168 256 Z" fill="#39FF14"/><path d="M216 0 L166 256 L246 256 Z" fill="#00D4FF"/></g>` },

  // Face shapes (skin tone is a colour swatch)
  { id: "face-oval",    name: "Oval",    slot: "face", priceCents: 0, svg: (p) => head("oval", p) },
  { id: "face-round",   name: "Round",   slot: "face", priceCents: 0, svg: (p) => head("round", p) },
  { id: "face-square",  name: "Square",  slot: "face", priceCents: 0, svg: (p) => head("square", p) },
  { id: "face-heart",   name: "Heart",   slot: "face", priceCents: 0, svg: (p) => head("heart", p) },
  { id: "face-long",    name: "Long",    slot: "face", priceCents: 0, svg: (p) => head("long", p) },
  { id: "face-diamond", name: "Diamond", slot: "face", priceCents: 0, svg: (p) => head("diamond", p) },

  // Eyes (iris colour is a swatch)
  { id: "eyes-almond", name: "Almond",    slot: "eyes", priceCents: 0, svg: eyes("almond") },
  { id: "eyes-round",  name: "Round",     slot: "eyes", priceCents: 0, svg: eyes("round") },
  { id: "eyes-hooded", name: "Hooded",    slot: "eyes", priceCents: 0, svg: eyes("hooded") },
  { id: "eyes-narrow", name: "Narrow",    slot: "eyes", priceCents: 0, svg: eyes("narrow") },
  { id: "eyes-upturn", name: "Upturned",  slot: "eyes", priceCents: 0, svg: eyes("upturn") },
  { id: "eyes-down",   name: "Downturned",slot: "eyes", priceCents: 0, svg: eyes("down") },
  { id: "eyes-wide",   name: "Wide",      slot: "eyes", priceCents: 0, svg: eyes("wide") },
  { id: "eyes-closed", name: "Closed",    slot: "eyes", priceCents: 0, svg: closedEyes },

  // Brows (hair colour)
  { id: "brows-soft",     name: "Soft",     slot: "brows", priceCents: 0, svg: brows("soft") },
  { id: "brows-arched",   name: "Arched",   slot: "brows", priceCents: 0, svg: brows("arched") },
  { id: "brows-straight", name: "Straight", slot: "brows", priceCents: 0, svg: brows("straight") },
  { id: "brows-thick",    name: "Thick",    slot: "brows", priceCents: 0, svg: brows("thick") },
  { id: "brows-thin",     name: "Thin",     slot: "brows", priceCents: 0, svg: brows("thin") },
  { id: "brows-angled",   name: "Angled",   slot: "brows", priceCents: 0, svg: brows("angled") },
  { id: "brows-slit",     name: "Slit",     slot: "brows", priceCents: 0, svg: brows("slit") },
  { id: "brows-none",     name: "None",     slot: "brows", priceCents: 0, svg: () => "" },

  // Noses
  { id: "nose-soft",     name: "Soft",     slot: "nose", priceCents: 0, svg: nose("soft") },
  { id: "nose-straight", name: "Straight", slot: "nose", priceCents: 0, svg: nose("straight") },
  { id: "nose-button",   name: "Button",   slot: "nose", priceCents: 0, svg: nose("button") },
  { id: "nose-wide",     name: "Wide",     slot: "nose", priceCents: 0, svg: nose("wide") },
  { id: "nose-pointed",  name: "Pointed",  slot: "nose", priceCents: 0, svg: nose("pointed") },
  { id: "nose-aquiline", name: "Aquiline", slot: "nose", priceCents: 0, svg: nose("aquiline") },
  { id: "nose-flat",     name: "Flat",     slot: "nose", priceCents: 0, svg: nose("flat") },

  // Mouths (lip colour is a swatch)
  { id: "mouth-smile",   name: "Smile",      slot: "mouth", priceCents: 0, svg: mouth("smile") },
  { id: "mouth-teeth",   name: "Big smile",  slot: "mouth", priceCents: 0, svg: mouth("teeth") },
  { id: "mouth-soft",    name: "Soft",       slot: "mouth", priceCents: 0, svg: mouth("soft") },
  { id: "mouth-neutral", name: "Neutral",    slot: "mouth", priceCents: 0, svg: mouth("neutral") },
  { id: "mouth-smirk",   name: "Smirk",      slot: "mouth", priceCents: 0, svg: mouth("smirk") },
  { id: "mouth-laugh",   name: "Laugh",      slot: "mouth", priceCents: 0, svg: mouth("laugh") },
  { id: "mouth-pout",    name: "Pout",       slot: "mouth", priceCents: 0, svg: mouth("pout") },
  { id: "mouth-full",    name: "Full lips",  slot: "mouth", priceCents: 0, svg: mouth("full") },
  { id: "mouth-grin",    name: "Grin",       slot: "mouth", priceCents: 0, svg: mouth("grin") },
  { id: "mouth-open",    name: "Oh",         slot: "mouth", priceCents: 0, svg: mouth("open") },
  { id: "mouth-tongue",  name: "Cheeky",     slot: "mouth", priceCents: 0, svg: mouth("tongue") },

  // Hair (colour is a swatch). Front over the head; back behind it.
  { id: "hair-none",    name: "Bald",        slot: "hair", priceCents: 0, svg: () => "" },
  { id: "hair-buzz",    name: "Buzz",        slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="${CROWN} Q128 100 72 112 Z" fill="${c}" opacity=".8"/>`) },
  { id: "hair-short",   name: "Short crop",  slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M68 112 C66 62 100 40 128 42 C156 40 190 62 188 112 Q186 96 170 92 Q128 70 86 92 Q70 96 68 112 Z" fill="${c}"/><path d="M86 92 Q128 70 170 92" fill="none" stroke="${d}" stroke-width="2" opacity=".4"/>`) },
  { id: "hair-side",    name: "Side part",   slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M66 116 C64 58 104 36 134 42 C166 44 190 66 188 112 Q182 92 160 90 Q130 84 100 92 Q78 98 66 116 Z" fill="${c}"/><path d="M100 92 Q116 78 148 82" fill="none" stroke="${d}" stroke-width="2" opacity=".5"/>`) },
  { id: "hair-fringe",  name: "Fringe",      slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="M68 118 C66 56 104 36 128 40 C152 36 190 56 188 118 L180 100 Q170 84 160 100 Q150 86 140 100 Q130 86 118 100 Q108 86 96 102 Q84 88 76 104 Z" fill="${c}"/>`) },
  { id: "hair-quiff",   name: "Quiff",       slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M68 112 C66 70 86 44 110 36 C130 28 160 26 176 44 C196 66 190 96 188 112 Q182 92 162 88 Q150 60 128 58 Q106 60 94 84 Q74 90 68 112 Z" fill="${c}"/><path d="M110 40 Q140 34 168 48" fill="none" stroke="${d}" stroke-width="2" opacity=".4"/>`) },
  { id: "hair-curly",   name: "Curly",       slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<g fill="${c}">${[[76,96],[92,70],[116,54],[140,54],[164,70],[180,96],[70,118],[186,118],[104,62],[152,62],[128,48]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="17"/>`).join("")}</g><g fill="${d}" opacity=".35">${[[86,84],[112,64],[146,62],[172,84]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="5"/>`).join("")}</g>`) },
  { id: "hair-afro",    name: "Afro",        slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M50 118 C46 44 210 44 206 118 Q196 94 176 92 Q128 68 80 92 Q60 94 50 118 Z" fill="${c}"/><path d="M80 92 Q128 68 176 92" fill="none" stroke="${d}" stroke-width="2" opacity=".35"/>`, (c, d) => `<circle cx="128" cy="104" r="84" fill="${c}"/><circle cx="100" cy="70" r="18" fill="${d}" opacity=".2"/>`) },
  { id: "hair-coils",   name: "Coils",       slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<g fill="${c}">${[[74,110],[80,86],[96,64],[118,50],[140,50],[162,64],[178,86],[184,110],[110,70],[146,70],[128,62]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="13"/>`).join("")}</g><g fill="none" stroke="${d}" stroke-width="1.5" opacity=".6">${[[80,86],[118,50],[162,64],[184,110]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join("")}</g>`) },
  { id: "hair-twists",  name: "Twists",      slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M68 112 C66 62 100 40 128 42 C156 40 190 62 188 112 Q186 96 170 92 Q128 70 86 92 Q70 96 68 112 Z" fill="${c}"/><g stroke="${d}" stroke-width="2" opacity=".6"><path d="M84 92 Q96 70 110 60 M104 86 Q116 66 132 56 M126 82 Q140 64 156 60 M150 86 Q162 72 174 94"/></g>`, (c) => `<g fill="${c}">${[60,74,88,168,182,196].map((x) => `<rect x="${x}" y="104" width="10" height="74" rx="5"/>`).join("")}</g>`) },
  { id: "hair-locs",    name: "Locs",        slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="M68 112 C66 62 100 40 128 42 C156 40 190 62 188 112 Q186 96 170 92 Q128 70 86 92 Q70 96 68 112 Z" fill="${c}"/>`, (c, d) => `<g fill="${c}">${[52,64,76,88,168,180,192,204].map((x, i) => `<rect x="${x}" y="100" width="10" height="${96 + (i % 3) * 14}" rx="5"/>`).join("")}</g><g fill="${d}" opacity=".3">${[58,82,174,198].map((x) => `<rect x="${x}" y="140" width="4" height="30" rx="2"/>`).join("")}</g>`) },
  { id: "hair-braids",  name: "Box braids",  slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M68 112 C66 62 100 40 128 42 C156 40 190 62 188 112 Q186 96 170 92 Q128 70 86 92 Q70 96 68 112 Z" fill="${c}"/><g stroke="${d}" stroke-width="1.5" opacity=".6"><path d="M80 100 L128 52 M96 92 L140 50 M114 86 L156 54 M132 86 L170 62 M150 88 L180 76"/></g>`, (c, d) => `<g fill="${c}">${[44,58,72,86,170,184,198,212].map((x) => `<rect x="${x}" y="100" width="11" height="150" rx="5"/>`).join("")}</g><g stroke="${d}" stroke-width="1.4" opacity=".5">${[44,58,72,86,170,184,198,212].map((x) => `<path d="M${x+2} 110 L${x+9} 124 L${x+2} 138 L${x+9} 152 L${x+2} 166 L${x+9} 180 L${x+2} 194 L${x+9} 208"/>`).join("")}</g>`) },
  { id: "hair-cornrows", name: "Cornrows",   slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M68 112 C66 62 100 40 128 42 C156 40 190 62 188 112 Q186 96 170 92 Q128 70 86 92 Q70 96 68 112 Z" fill="${c}"/><g fill="none" stroke="${d}" stroke-width="2.2" opacity=".75"><path d="M76 104 Q84 66 112 48 M92 96 Q100 62 128 44 M110 90 Q116 60 144 46 M128 88 Q134 62 160 52 M146 90 Q152 68 174 66"/></g>`) },
  { id: "hair-bob",     name: "Bob",         slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="M62 124 C56 56 108 34 128 38 C148 34 200 56 194 124 L186 118 Q176 86 150 82 Q128 78 106 82 Q80 86 70 118 Z" fill="${c}"/>`, (c) => `<path d="M60 120 Q56 190 76 200 L180 200 Q200 190 196 120 Q128 60 60 120 Z" fill="${c}"/>`) },
  { id: "hair-lob",     name: "Long bob",    slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="M62 124 C56 56 108 34 128 38 C148 34 200 56 194 124 L186 118 Q176 86 150 82 Q128 78 106 82 Q80 86 70 118 Z" fill="${c}"/>`, (c) => `<path d="M58 120 Q52 220 70 232 L186 232 Q204 220 198 120 Q128 60 58 120 Z" fill="${c}"/>`) },
  { id: "hair-long",    name: "Long",        slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="M64 124 C58 56 108 34 128 38 C148 34 198 56 192 124 L186 118 Q176 86 150 82 Q128 78 106 82 Q80 86 70 118 Z" fill="${c}"/>`, (c, d) => `<path d="M56 120 Q44 230 56 256 L200 256 Q212 230 200 120 Q128 56 56 120 Z" fill="${c}"/><path d="M80 150 Q74 210 82 256 M176 150 Q182 210 174 256" fill="none" stroke="${d}" stroke-width="2" opacity=".4"/>`) },
  { id: "hair-waves",   name: "Long waves",  slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="M64 124 C58 56 108 34 128 38 C148 34 198 56 192 124 L184 116 Q170 84 146 84 Q128 80 110 84 Q86 84 72 116 Z" fill="${c}"/>`, (c, d) => `<path d="M56 120 Q40 170 60 200 Q44 230 60 256 L196 256 Q212 230 196 200 Q216 170 200 120 Q128 56 56 120 Z" fill="${c}"/><g fill="none" stroke="${d}" stroke-width="2" opacity=".4"><path d="M78 140 Q66 170 80 196 Q66 224 80 252 M178 140 Q190 170 176 196 Q190 224 176 252"/></g>`) },
  { id: "hair-pony",    name: "Ponytail",    slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M66 116 C64 58 104 36 128 40 C152 36 192 58 190 116 Q182 92 160 88 Q128 80 96 88 Q74 92 66 116 Z" fill="${c}"/><path d="M96 88 Q128 76 160 88" fill="none" stroke="${d}" stroke-width="2" opacity=".4"/>`, (c) => `<path d="M186 100 Q222 130 206 200 Q200 160 182 126 Z" fill="${c}"/>`) },
  { id: "hair-bun",     name: "Top bun",     slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M66 116 C64 58 104 36 128 40 C152 36 192 58 190 116 Q182 92 160 88 Q128 80 96 88 Q74 92 66 116 Z" fill="${c}"/><circle cx="128" cy="40" r="19" fill="${c}"/><circle cx="128" cy="40" r="19" fill="none" stroke="${d}" stroke-width="2" opacity=".4"/>`) },
  { id: "hair-space",   name: "Space buns",  slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M66 116 C64 58 104 36 128 40 C152 36 192 58 190 116 Q182 92 160 88 Q128 80 96 88 Q74 92 66 116 Z" fill="${c}"/><circle cx="84" cy="54" r="17" fill="${c}"/><circle cx="172" cy="54" r="17" fill="${c}"/><g fill="none" stroke="${d}" stroke-width="2" opacity=".4"><circle cx="84" cy="54" r="8"/><circle cx="172" cy="54" r="8"/></g>`) },
  { id: "hair-pixie",   name: "Pixie",       slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="M64 120 C58 56 110 30 134 40 C160 36 196 60 190 118 L176 104 Q168 88 150 96 Q140 84 124 96 Q110 84 98 100 Q82 90 72 108 Z" fill="${c}"/>`) },
  { id: "hair-mohawk",  name: "Mohawk",      slot: "hair", priceCents: 100, ...hairStyle((c, d) => `<path d="M112 108 L108 30 L128 14 L148 30 L144 108 Z" fill="${c}"/><path d="M112 108 L108 30 L128 14" fill="none" stroke="${d}" stroke-width="2" opacity=".5"/>`) },
  { id: "hair-undercut", name: "Undercut",   slot: "hair", priceCents: 0, ...hairStyle((c, d) => `<path d="M72 112 Q70 90 84 86 L92 60 Q128 34 164 60 L172 86 Q186 90 184 112 Q180 98 166 96 Q128 76 90 96 Q76 98 72 112 Z" fill="${c}"/><path d="M92 60 Q128 40 164 60" fill="none" stroke="${d}" stroke-width="2" opacity=".5"/><path d="${CROWN} Q128 100 72 112 Z" fill="${c}" opacity=".35"/>`) },
  { id: "hair-mullet",  name: "Mullet",      slot: "hair", priceCents: 0, ...hairStyle((c) => `<path d="M68 112 C66 58 104 36 128 40 C152 36 190 58 188 112 Q182 92 160 88 Q128 80 96 88 Q74 92 68 112 Z" fill="${c}"/>`, (c) => `<path d="M66 110 Q58 180 72 206 L184 206 Q198 180 190 110 Q128 80 66 110 Z" fill="${c}"/>`) },
  { id: "hair-dye",     name: "Two-tone",    slot: "hair", priceCents: 150, ...hairStyle((c) => `<path d="M64 124 C58 56 108 34 128 38 C148 34 198 56 192 124 L186 118 Q176 86 150 82 Q128 78 106 82 Q80 86 70 118 Z" fill="${c}"/>`, (c) => `<defs><linearGradient id="g-dye" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="${c}"/><stop offset=".6" stop-color="#CC00FF"/><stop offset="1" stop-color="#00D4FF"/></linearGradient></defs><path d="M56 120 Q44 230 56 256 L200 256 Q212 230 200 120 Q128 56 56 120 Z" fill="url(#g-dye)"/>`) },

  // Facial hair (hair colour)
  { id: "facial-none",      name: "Clean",      slot: "facial", priceCents: 0,   svg: () => "" },
  { id: "facial-stubble",   name: "Stubble",    slot: "facial", priceCents: 0,   svg: facialHair("stubble") },
  { id: "facial-mustache",  name: "Mustache",   slot: "facial", priceCents: 0,   svg: facialHair("mustache") },
  { id: "facial-goatee",    name: "Goatee",     slot: "facial", priceCents: 0,   svg: facialHair("goatee") },
  { id: "facial-chin",      name: "Chin strap", slot: "facial", priceCents: 0,   svg: facialHair("chin") },
  { id: "facial-beard",     name: "Full beard", slot: "facial", priceCents: 0,   svg: facialHair("full") },
  { id: "facial-long",      name: "Long beard", slot: "facial", priceCents: 0,   svg: facialHair("long") },
  { id: "facial-soul",      name: "Soul patch", slot: "facial", priceCents: 0,   svg: facialHair("soul") },
  { id: "facial-handlebar", name: "Handlebar",  slot: "facial", priceCents: 0,   svg: facialHair("handlebar") },
  { id: "facial-neon",      name: "Neon beard", slot: "facial", priceCents: 200, svg: facialHair("neon") },

  // Eyewear
  { id: "glasses-none",    name: "None",        slot: "glasses", priceCents: 0,   svg: () => "" },
  { id: "glasses-round",   name: "Round",       slot: "glasses", priceCents: 0,   svg: glasses("round") },
  { id: "glasses-square",  name: "Square",      slot: "glasses", priceCents: 0,   svg: glasses("square") },
  { id: "glasses-cateye",  name: "Cat-eye",     slot: "glasses", priceCents: 0,   svg: glasses("cateye") },
  { id: "glasses-aviator", name: "Aviators",    slot: "glasses", priceCents: 100, svg: glasses("aviator") },
  { id: "glasses-shades",  name: "Shades",      slot: "glasses", priceCents: 100, svg: glasses("shades") },
  { id: "glasses-heart",   name: "Heart frames",slot: "glasses", priceCents: 150, svg: glasses("heart") },
  { id: "glasses-visor",   name: "Cyber visor", slot: "glasses", priceCents: 200, svg: glasses("visor") },
  { id: "glasses-glow",    name: "Glowstick shades", slot: "glasses", priceCents: 250, svg: glasses("glow") },
  { id: "glasses-monocle", name: "Monocle",     slot: "glasses", priceCents: 200, svg: glasses("monocle") },

  // Earrings
  { id: "ear-none",    name: "None",        slot: "earrings", priceCents: 0,   svg: () => "" },
  { id: "ear-studs",   name: "Studs",       slot: "earrings", priceCents: 0,   svg: earrings("studs") },
  { id: "ear-hoops",   name: "Hoops",       slot: "earrings", priceCents: 0,   svg: earrings("hoops") },
  { id: "ear-bighoops",name: "Big hoops",   slot: "earrings", priceCents: 0,   svg: earrings("bighoops") },
  { id: "ear-drops",   name: "Drops",       slot: "earrings", priceCents: 0,   svg: earrings("drops") },
  { id: "ear-pearls",  name: "Pearls",      slot: "earrings", priceCents: 0,   svg: earrings("pearls") },
  { id: "ear-cross",   name: "Crosses",     slot: "earrings", priceCents: 0,   svg: earrings("cross") },
  { id: "ear-gauges",  name: "Gauges",      slot: "earrings", priceCents: 0,   svg: earrings("gauges") },
  { id: "ear-feather", name: "Feathers",    slot: "earrings", priceCents: 100, svg: earrings("feather") },
  { id: "ear-neon",    name: "Neon hoops",  slot: "earrings", priceCents: 150, svg: earrings("neon") },

  // Headwear (hat colour is a swatch where it applies)
  { id: "hat-none",     name: "None",         slot: "hat", priceCents: 0,   svg: () => "" },
  { id: "hat-cap",      name: "Cap",          slot: "hat", priceCents: 0,   svg: hat("cap") },
  { id: "hat-snapback", name: "Backwards cap",slot: "hat", priceCents: 0,   svg: hat("snapback") },
  { id: "hat-beanie",   name: "Beanie",       slot: "hat", priceCents: 0,   svg: hat("beanie") },
  { id: "hat-pom",      name: "Pom beanie",   slot: "hat", priceCents: 0,   svg: hat("pom") },
  { id: "hat-bucket",   name: "Bucket hat",   slot: "hat", priceCents: 0,   svg: hat("bucket") },
  { id: "hat-cowboy",   name: "Cowboy",       slot: "hat", priceCents: 100, svg: hat("cowboy") },
  { id: "hat-fedora",   name: "Fedora",       slot: "hat", priceCents: 100, svg: hat("fedora") },
  { id: "hat-beret",    name: "Beret",        slot: "hat", priceCents: 0,   svg: hat("beret") },
  { id: "hat-headwrap", name: "Head wrap",    slot: "hat", priceCents: 0,   svg: hat("headwrap"), hidesHair: true },
  { id: "hat-hijab",    name: "Hijab",        slot: "hat", priceCents: 0,   svg: hat("hijab"), hidesHair: true },
  { id: "hat-durag",    name: "Durag",        slot: "hat", priceCents: 0,   svg: hat("durag"), hidesHair: true },
  { id: "hat-turban",   name: "Turban",       slot: "hat", priceCents: 0,   svg: hat("turban"), hidesHair: true },
  { id: "hat-kufi",     name: "Kufi",         slot: "hat", priceCents: 0,   svg: hat("kufi") },
  { id: "hat-headband", name: "Headband",     slot: "hat", priceCents: 0,   svg: hat("headband") },
  { id: "hat-bandana",  name: "Bandana",      slot: "hat", priceCents: 0,   svg: hat("bandana") },
  { id: "hat-flower",   name: "Flower crown", slot: "hat", priceCents: 150, svg: hat("flowers") },
  { id: "hat-crown",    name: "Crown",        slot: "hat", priceCents: 500, svg: hat("crown") },
  { id: "hat-tiara",    name: "Tiara",        slot: "hat", priceCents: 300, svg: hat("tiara") },
  { id: "hat-halo",     name: "Glow halo",    slot: "hat", priceCents: 300, svg: hat("halo") },
  { id: "hat-horns",    name: "Horns",        slot: "hat", priceCents: 200, svg: hat("horns") },
  { id: "hat-hood",     name: "Hood",         slot: "hat", priceCents: 100, svg: hat("hood"), hidesHair: true },

  // Neckwear
  { id: "neck-none",    name: "None",        slot: "neck", priceCents: 0,   svg: () => "" },
  { id: "neck-gold",    name: "Gold chain",  slot: "neck", priceCents: 0,   svg: neckwear("gold") },
  { id: "neck-silver",  name: "Silver chain",slot: "neck", priceCents: 0,   svg: neckwear("silver") },
  { id: "neck-pendant", name: "Pendant",     slot: "neck", priceCents: 100, svg: neckwear("pendant") },
  { id: "neck-pearls",  name: "Pearls",      slot: "neck", priceCents: 100, svg: neckwear("pearls") },
  { id: "neck-kandi",   name: "Kandi",       slot: "neck", priceCents: 0,   svg: neckwear("kandi") },
  { id: "neck-choker",  name: "Choker",      slot: "neck", priceCents: 0,   svg: neckwear("choker") },
  { id: "neck-scarf",   name: "Scarf",       slot: "neck", priceCents: 0,   svg: neckwear("scarf") },
  { id: "neck-bowtie",  name: "Bow tie",     slot: "neck", priceCents: 0,   svg: neckwear("bowtie") },
  { id: "neck-bandana", name: "Neckerchief", slot: "neck", priceCents: 0,   svg: neckwear("bandana") },
  { id: "neck-glow",    name: "Glowstick necklace", slot: "neck", priceCents: 250, svg: neckwear("glow") },

  // Tops (colour is a swatch)
  { id: "top-tee",      name: "T-shirt",    slot: "top", priceCents: 0,   svg: top("tee") },
  { id: "top-vneck",    name: "V-neck",     slot: "top", priceCents: 0,   svg: top("vneck") },
  { id: "top-hoodie",   name: "Hoodie",     slot: "top", priceCents: 0,   svg: top("hoodie") },
  { id: "top-jacket",   name: "Jacket",     slot: "top", priceCents: 0,   svg: top("jacket") },
  { id: "top-buttonup", name: "Button-up",  slot: "top", priceCents: 0,   svg: top("buttonup") },
  { id: "top-tank",     name: "Tank",       slot: "top", priceCents: 0,   svg: top("tank") },
  { id: "top-blouse",   name: "Blouse",     slot: "top", priceCents: 0,   svg: top("blouse") },
  { id: "top-turtle",   name: "Turtleneck", slot: "top", priceCents: 0,   svg: top("turtle") },
  { id: "top-suit",     name: "Suit",       slot: "top", priceCents: 100, svg: top("suit") },
  { id: "top-jersey",   name: "Jersey",     slot: "top", priceCents: 0,   svg: top("jersey") },
  { id: "top-kimono",   name: "Kimono",     slot: "top", priceCents: 100, svg: top("kimono") },
  { id: "top-dashiki",  name: "Dashiki",    slot: "top", priceCents: 0,   svg: top("dashiki") },
  { id: "top-mesh",     name: "Festival mesh", slot: "top", priceCents: 150, svg: top("mesh") },

  // Extras
  { id: "extra-none",     name: "None",        slot: "extras", priceCents: 0,   svg: () => "" },
  { id: "extra-freckles", name: "Freckles",    slot: "extras", priceCents: 0,   svg: extras("freckles") },
  { id: "extra-blush",    name: "Blush",       slot: "extras", priceCents: 0,   svg: extras("blush") },
  { id: "extra-mark",     name: "Beauty mark", slot: "extras", priceCents: 0,   svg: extras("mark") },
  { id: "extra-lashes",   name: "Lashes",      slot: "extras", priceCents: 0,   svg: extras("lashes") },
  { id: "extra-nosering", name: "Nose ring",   slot: "extras", priceCents: 0,   svg: extras("nosering") },
  { id: "extra-septum",   name: "Septum ring", slot: "extras", priceCents: 0,   svg: extras("septum") },
  { id: "extra-scar",     name: "Scar",        slot: "extras", priceCents: 0,   svg: extras("scar") },
  { id: "extra-paint",    name: "Face paint",  slot: "extras", priceCents: 100, svg: extras("paint") },
  { id: "extra-glitter",  name: "Glitter",     slot: "extras", priceCents: 150, svg: extras("glitter") },
];

// ---- lookups & composition -------------------------------------------

export const ITEM_BY_ID: Record<string, AvatarItem> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const DEFAULT_PARTS: Record<Slot, string> = {
  background: "bg-void", face: "face-oval", extras: "extra-none", eyes: "eyes-almond", brows: "brows-soft", nose: "nose-soft",
  mouth: "mouth-smile", hair: "hair-short", facial: "facial-none", glasses: "glasses-none", earrings: "ear-none",
  hat: "hat-none", neck: "neck-none", top: "top-tee",
};

export type AvatarConfig = { v: 2; parts: Record<Slot, string>; colors: Colors };
type LegacyConfig = Partial<Record<string, string>>;

// A few v1 ids map onto their v2 successors so saved looks don't reset entirely.
const V1_MAP: Record<string, string> = {
  "base-sand": "skin:sand", "base-clay": "skin:caramel", "base-umber": "skin:sienna", "base-slate": "skin:ivory", "base-moss": "skin:honey",
  "hair-buzz": "hair-buzz", "hair-long": "hair-long", "hair-mohawk": "hair-mohawk", "hair-spike": "hair-quiff", "hair-bun": "hair-bun",
  "hair-pony": "hair-pony", "hair-wave": "hair-waves", "hair-locs": "hair-locs", "hair-dye": "hair-dye", "hair-none": "hair-none",
  "mouth-smile": "mouth-smile", "mouth-line": "mouth-neutral", "mouth-grin": "mouth-grin", "mouth-tongue": "mouth-tongue",
  "eyes-dot": "eyes-round", "eyes-happy": "eyes-closed", "eyes-wink": "eyes-almond", "eyes-star": "eyes-wide", "eyes-neon": "eyes-wide",
  "facial-stubble": "facial-stubble", "facial-mustache": "facial-mustache", "facial-goatee": "facial-goatee", "facial-beard": "facial-beard", "facial-neon": "facial-neon",
  "glasses-round": "glasses-round", "glasses-shades": "glasses-shades", "glasses-heart": "glasses-heart", "glasses-visor": "glasses-visor", "glasses-glow": "glasses-glow",
  "hat-beanie": "hat-beanie", "hat-cap": "hat-cap", "hat-crown": "hat-crown", "hat-headband": "hat-headband", "hat-bandana": "hat-bandana",
  "hat-bucket": "hat-bucket", "hat-flower": "hat-flower", "hat-halo": "hat-halo",
  "neck-kandi": "neck-kandi", "neck-chain": "neck-gold", "neck-glow": "neck-glow",
  "bg-void": "bg-void", "bg-moss": "bg-moss", "bg-dusk": "bg-dusk", "bg-aurora": "bg-aurora", "bg-grid": "bg-grid", "bg-ember": "bg-ember", "bg-tide": "bg-tide",
};

/** Merge any saved config (v1 or v2, partial or stale) onto the defaults, dropping unknown ids. */
export function normalizeConfig(raw?: unknown): AvatarConfig {
  const parts = { ...DEFAULT_PARTS };
  const colors = { ...DEFAULT_COLORS };
  if (raw && typeof raw === "object") {
    const r = raw as { v?: number; parts?: LegacyConfig; colors?: Partial<Colors> } & LegacyConfig;
    if (r.v === 2 && r.parts) {
      for (const slot of SLOTS) { const id = r.parts[slot]; if (id && ITEM_BY_ID[id]?.slot === slot) parts[slot] = id; }
      for (const k of Object.keys(DEFAULT_COLORS) as ColorSlot[]) { const id = r.colors?.[k]; if (id && COLOR_OPTIONS[k].some((c) => c.id === id)) colors[k] = id; }
    } else {
      for (const id of Object.values(r)) {
        if (typeof id !== "string") continue;
        const to = V1_MAP[id]; if (!to) continue;
        if (to.startsWith("skin:")) { colors.skin = to.slice(5); continue; }
        const item = ITEM_BY_ID[to]; if (item) parts[item.slot] = to;
      }
    }
  }
  return { v: 2, parts, colors };
}

export function composeAvatarSvg(raw?: unknown): string {
  const cfg = normalizeConfig(raw);
  const p = palette(cfg.colors);
  const hatItem = ITEM_BY_ID[cfg.parts.hat];
  const layers: { z: number; svg: string }[] = [];
  for (const slot of SLOTS) {
    const item = ITEM_BY_ID[cfg.parts[slot]];
    if (!item) continue;
    if (slot === "hair" && hatItem?.hidesHair) continue;
    if (item.back) layers.push({ z: HAIR_BACK_Z, svg: item.back(p) });
    layers.push({ z: Z[slot], svg: item.svg(p) });
  }
  const inner = layers.sort((a, b) => a.z - b.z).map((l) => l.svg).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${inner}</svg>`;
}

/** data:-URI for an <img src> and for user_profiles.avatar_url. */
export function avatarDataUri(raw?: unknown): string {
  return `data:image/svg+xml,${encodeURIComponent(composeAvatarSvg(raw))}`;
}
