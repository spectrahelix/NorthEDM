// Avatar parts catalog. Pure module — imported by the builder UI (client) and
// the purchase route (server, which is the price authority). Each item is a
// snippet of SVG markup drawn in a 256×256 coordinate space; the composer
// stacks the selected items by slot z-order into one SVG.

export type Slot =
  | "background"
  | "base"
  | "mouth"
  | "eyes"
  | "glasses"
  | "hair"
  | "hat";

export const SLOTS: Slot[] = [
  "background", "base", "mouth", "eyes", "glasses", "hair", "hat",
];

export const SLOT_LABELS: Record<Slot, string> = {
  background: "Backdrop",
  base: "Skin",
  mouth: "Mouth",
  eyes: "Eyes",
  glasses: "Eyewear",
  hair: "Hair",
  hat: "Headwear",
};

const SLOT_Z: Record<Slot, number> = {
  background: 0, base: 10, mouth: 20, eyes: 22, glasses: 30, hair: 40, hat: 50,
};

export type AvatarItem = {
  id: string;
  name: string;
  slot: Slot;
  priceCents: number; // 0 = free for everyone
  svg: string;        // inner SVG markup (256×256 space)
};

// ---- Parts -------------------------------------------------------------

export const ITEMS: AvatarItem[] = [
  // Backdrops
  { id: "bg-void",   name: "Void",     slot: "background", priceCents: 0,   svg: `<rect width="256" height="256" fill="#0b0b0d"/>` },
  { id: "bg-moss",   name: "Moss",     slot: "background", priceCents: 0,   svg: `<rect width="256" height="256" fill="#12241b"/>` },
  { id: "bg-dusk",   name: "Dusk",     slot: "background", priceCents: 0,   svg: `<rect width="256" height="256" fill="#1a1430"/>` },
  { id: "bg-aurora", name: "Aurora",   slot: "background", priceCents: 100, svg: `<defs><linearGradient id="g-aurora" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#39FF14"/><stop offset="55%" stop-color="#00D4FF"/><stop offset="100%" stop-color="#CC00FF"/></linearGradient></defs><rect width="256" height="256" fill="url(#g-aurora)"/><rect width="256" height="256" fill="#000" opacity="0.35"/>` },
  { id: "bg-grid",   name: "Neon Grid",slot: "background", priceCents: 150, svg: `<rect width="256" height="256" fill="#070b10"/><g stroke="#00D4FF" stroke-width="1" opacity="0.5"><path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256"/></g>` },

  // Skin
  { id: "base-sand",  name: "Sand",   slot: "base", priceCents: 0, svg: skin("#e8c39a") },
  { id: "base-clay",  name: "Clay",   slot: "base", priceCents: 0, svg: skin("#c97b53") },
  { id: "base-umber", name: "Umber",  slot: "base", priceCents: 0, svg: skin("#8a5a3b") },
  { id: "base-slate", name: "Slate",  slot: "base", priceCents: 0, svg: skin("#9aa7b3") },
  { id: "base-moss",  name: "Sporeling", slot: "base", priceCents: 100, svg: skin("#7faf6a") },

  // Mouths
  { id: "mouth-smile", name: "Smile",  slot: "mouth", priceCents: 0, svg: `<path d="M104 164 q24 22 48 0" fill="none" stroke="#1a1414" stroke-width="5" stroke-linecap="round"/>` },
  { id: "mouth-line",  name: "Stoic",  slot: "mouth", priceCents: 0, svg: `<path d="M110 168 H146" stroke="#1a1414" stroke-width="5" stroke-linecap="round"/>` },
  { id: "mouth-grin",  name: "Grin",   slot: "mouth", priceCents: 0, svg: `<path d="M104 160 q24 28 48 0 Z" fill="#1a1414"/><path d="M110 162 q18 8 36 0" fill="#fff"/>` },

  // Eyes
  { id: "eyes-dot",   name: "Dots",    slot: "eyes", priceCents: 0, svg: `<circle cx="104" cy="132" r="8" fill="#161616"/><circle cx="152" cy="132" r="8" fill="#161616"/>` },
  { id: "eyes-happy", name: "Happy",   slot: "eyes", priceCents: 0, svg: `<path d="M94 134 q10 -12 20 0" fill="none" stroke="#161616" stroke-width="5" stroke-linecap="round"/><path d="M142 134 q10 -12 20 0" fill="none" stroke="#161616" stroke-width="5" stroke-linecap="round"/>` },
  { id: "eyes-star",  name: "Starry",  slot: "eyes", priceCents: 150, svg: `${star(104,132)}${star(152,132)}` },

  // Eyewear
  { id: "glasses-none",   name: "None",     slot: "glasses", priceCents: 0,   svg: `` },
  { id: "glasses-round",  name: "Round",    slot: "glasses", priceCents: 100, svg: `<g fill="none" stroke="#1a1414" stroke-width="4"><circle cx="104" cy="132" r="17"/><circle cx="152" cy="132" r="17"/><path d="M121 132 H135"/></g>` },
  { id: "glasses-shades", name: "Shades",   slot: "glasses", priceCents: 200, svg: `<g><rect x="86" y="120" width="36" height="24" rx="8" fill="#101014"/><rect x="134" y="120" width="36" height="24" rx="8" fill="#101014"/><path d="M122 126 H134" stroke="#101014" stroke-width="5"/><path d="M90 124 l24 6" stroke="#39FF14" stroke-width="2" opacity="0.6"/></g>` },

  // Hair
  { id: "hair-none",   name: "Bald",    slot: "hair", priceCents: 0,   svg: `` },
  { id: "hair-buzz",   name: "Tuft",    slot: "hair", priceCents: 0,   svg: `<path d="M60 122 Q128 58 196 122 Q170 92 128 92 Q86 92 60 122 Z" fill="#2c2018"/>` },
  { id: "hair-long",   name: "Flow",    slot: "hair", priceCents: 100, svg: `<path d="M54 120 Q128 56 202 120 L196 184 Q188 150 184 120 Q160 96 128 96 Q96 96 72 120 Q68 150 60 184 Z" fill="#3a2a40"/>` },
  { id: "hair-mohawk", name: "Mohawk",  slot: "hair", priceCents: 150, svg: `<path d="M118 60 H138 L132 116 H124 Z" fill="#39FF14"/><path d="M118 60 H138 L136 78 H120 Z" fill="#00D4FF"/>` },

  // Headwear
  { id: "hat-none",   name: "None",     slot: "hat", priceCents: 0,   svg: `` },
  { id: "hat-beanie", name: "Beanie",   slot: "hat", priceCents: 150, svg: `<path d="M66 116 a62 40 0 0 1 124 0 Z" fill="#c0392b"/><rect x="62" y="110" width="132" height="16" rx="8" fill="#962d22"/>` },
  { id: "hat-cap",    name: "Cap",      slot: "hat", priceCents: 150, svg: `<path d="M72 114 a56 38 0 0 1 112 0 Z" fill="#00A6C9"/><rect x="120" y="108" width="74" height="13" rx="6" fill="#0090b0"/>` },
  { id: "hat-crown",  name: "Crown",    slot: "hat", priceCents: 500, svg: `<path d="M84 106 L94 72 L112 96 L128 64 L144 96 L162 72 L172 106 Z" fill="#E8FF47" stroke="#b8a000" stroke-width="2"/><circle cx="128" cy="78" r="4" fill="#FF5C3A"/>` },
];

function skin(color: string): string {
  return `<ellipse cx="128" cy="142" rx="74" ry="80" fill="${color}"/><ellipse cx="60" cy="146" rx="11" ry="14" fill="${color}"/><ellipse cx="196" cy="146" rx="11" ry="14" fill="${color}"/>`;
}

function star(cx: number, cy: number): string {
  return `<path transform="translate(${cx - 12} ${cy - 12}) scale(0.5)" d="M24 2 L29 17 L45 17 L32 27 L37 43 L24 33 L11 43 L16 27 L3 17 L19 17 Z" fill="#E8FF47"/>`;
}

// ---- Lookups & composition --------------------------------------------

export const ITEM_BY_ID: Record<string, AvatarItem> =
  Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const DEFAULT_CONFIG: Record<Slot, string> = {
  background: "bg-void",
  base: "base-sand",
  mouth: "mouth-smile",
  eyes: "eyes-dot",
  glasses: "glasses-none",
  hair: "hair-none",
  hat: "hat-none",
};

export type AvatarConfig = Partial<Record<Slot, string>>;

// Merge a (possibly partial / stale) config onto the defaults, dropping ids
// that are no longer in the catalog.
export function normalizeConfig(config?: AvatarConfig | null): Record<Slot, string> {
  const out = { ...DEFAULT_CONFIG };
  if (config) {
    for (const slot of SLOTS) {
      const id = config[slot];
      if (id && ITEM_BY_ID[id]?.slot === slot) out[slot] = id;
    }
  }
  return out;
}

export function composeAvatarSvg(config?: AvatarConfig | null): string {
  const cfg = normalizeConfig(config);
  const inner = SLOTS
    .map((slot) => ITEM_BY_ID[cfg[slot]])
    .filter(Boolean)
    .sort((a, b) => SLOT_Z[a.slot] - SLOT_Z[b.slot])
    .map((i) => i.svg)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${inner}</svg>`;
}

// data:-URI suitable for an <img src> and for storing in user_profiles.avatar_url.
export function avatarDataUri(config?: AvatarConfig | null): string {
  return `data:image/svg+xml,${encodeURIComponent(composeAvatarSvg(config))}`;
}
