// Avatar parts catalog. Pure module — imported by the builder UI (client) and
// the purchase route (server, which is the price authority). Each item is a
// snippet of SVG markup drawn in a 256×256 coordinate space; the composer
// stacks the selected items by slot z-order into one SVG.

export type Slot =
  | "background"
  | "base"
  | "neck"
  | "facial"
  | "mouth"
  | "eyes"
  | "glasses"
  | "hair"
  | "hat";

export const SLOTS: Slot[] = [
  "background", "base", "mouth", "eyes", "facial", "glasses", "hair", "hat", "neck",
];

export const SLOT_LABELS: Record<Slot, string> = {
  background: "Backdrop",
  base: "Skin",
  neck: "Necklace",
  facial: "Facial Hair",
  mouth: "Mouth",
  eyes: "Eyes",
  glasses: "Eyewear",
  hair: "Hair",
  hat: "Headwear",
};

const SLOT_Z: Record<Slot, number> = {
  background: 0, base: 10, neck: 12, facial: 15, mouth: 20, eyes: 22, glasses: 30, hair: 40, hat: 50,
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

  // More free backdrops
  { id: "bg-ember", name: "Ember", slot: "background", priceCents: 0, svg: `<rect width="256" height="256" fill="#26120c"/>` },
  { id: "bg-tide",  name: "Tide",  slot: "background", priceCents: 0, svg: `<rect width="256" height="256" fill="#0a1c24"/>` },

  // More free faces
  { id: "mouth-tongue", name: "Cheeky", slot: "mouth", priceCents: 0, svg: `<path d="M104 160 q24 26 48 0 Z" fill="#1a1414"/><path d="M120 172 q8 12 16 0 Z" fill="#e0567a"/>` },
  { id: "eyes-wink",    name: "Wink",   slot: "eyes",  priceCents: 0, svg: `<circle cx="104" cy="132" r="8" fill="#161616"/><path d="M142 134 q10 -10 20 0" fill="none" stroke="#161616" stroke-width="5" stroke-linecap="round"/>` },
  { id: "eyes-neon",    name: "Neon",   slot: "eyes",  priceCents: 150, svg: `<circle cx="104" cy="132" r="7" fill="#39FF14"/><circle cx="152" cy="132" r="7" fill="#00D4FF"/><circle cx="104" cy="132" r="10" fill="none" stroke="#39FF14" stroke-width="2" opacity="0.4"/><circle cx="152" cy="132" r="10" fill="none" stroke="#00D4FF" stroke-width="2" opacity="0.4"/>` },

  // Facial hair
  { id: "facial-none",     name: "Clean",     slot: "facial", priceCents: 0,   svg: `` },
  { id: "facial-stubble",  name: "Stubble",   slot: "facial", priceCents: 0,   svg: `<path d="M88 172 Q128 210 168 172 Q160 200 128 206 Q96 200 88 172 Z" fill="#2c2018" opacity="0.32"/>` },
  { id: "facial-mustache", name: "Mustache",  slot: "facial", priceCents: 0,   svg: `<path d="M106 160 Q118 154 128 160 Q138 154 150 160 Q138 170 128 165 Q118 170 106 160 Z" fill="#2c2018"/>` },
  { id: "facial-goatee",   name: "Goatee",    slot: "facial", priceCents: 100, svg: `<path d="M108 160 Q118 154 128 160 Q138 154 148 160 Q140 168 128 165 Q116 168 108 160 Z" fill="#2c2018"/><path d="M116 184 Q128 206 140 184 Q134 196 128 196 Q122 196 116 184 Z" fill="#2c2018"/>` },
  { id: "facial-beard",    name: "Full Beard",slot: "facial", priceCents: 100, svg: `<path d="M82 150 Q86 206 128 216 Q170 206 174 150 Q158 194 128 196 Q98 194 82 150 Z" fill="#2c2018"/>` },
  { id: "facial-neon",     name: "Neon Beard",slot: "facial", priceCents: 200, svg: `<path d="M82 150 Q86 206 128 216 Q170 206 174 150 Q158 194 128 196 Q98 194 82 150 Z" fill="#123a1a"/><path d="M82 150 Q86 206 128 216 Q170 206 174 150" fill="none" stroke="#39FF14" stroke-width="2" opacity="0.6"/>` },

  // More hair
  { id: "hair-spike", name: "Spikes",  slot: "hair", priceCents: 0,   svg: `<path d="M68 112 L82 70 L98 108 L112 66 L128 106 L144 66 L158 108 L174 70 L188 112 Q128 96 68 112 Z" fill="#1f1a16"/>` },
  { id: "hair-bun",   name: "Top Bun", slot: "hair", priceCents: 0,   svg: `<path d="M60 122 Q128 58 196 122 Q170 92 128 92 Q86 92 60 122 Z" fill="#2c2018"/><circle cx="128" cy="66" r="15" fill="#2c2018"/>` },
  { id: "hair-pony",  name: "Ponytail",slot: "hair", priceCents: 0,   svg: `<path d="M58 118 Q128 58 198 118 Q174 92 128 92 Q82 92 58 118 Z" fill="#2c2018"/><path d="M194 114 Q214 148 200 188 Q196 156 186 128 Z" fill="#2c2018"/>` },
  { id: "hair-wave",  name: "Waves",   slot: "hair", priceCents: 100, svg: `<path d="M52 120 Q128 54 204 120 L198 188 Q192 158 190 130 Q184 150 176 148 Q184 120 160 102 Q128 94 96 102 Q72 120 80 148 Q72 150 66 130 Q64 158 58 188 Z" fill="#3a2a40"/>` },
  { id: "hair-locs",  name: "Locs",    slot: "hair", priceCents: 150, svg: `<g fill="#241a12"><path d="M60 120 Q128 58 196 120 Q170 92 128 92 Q86 92 60 120 Z"/><rect x="56" y="116" width="8" height="72" rx="4"/><rect x="72" y="120" width="8" height="78" rx="4"/><rect x="176" y="120" width="8" height="78" rx="4"/><rect x="192" y="116" width="8" height="72" rx="4"/></g>` },
  { id: "hair-dye",   name: "Neon Dye",slot: "hair", priceCents: 200, svg: `<path d="M56 120 Q128 56 200 120 Q174 92 128 92 Q82 92 56 120 Z" fill="#141414"/><path d="M56 120 Q128 56 200 120" fill="none" stroke="#CC00FF" stroke-width="4" opacity="0.85"/><path d="M62 112 Q128 64 194 112" fill="none" stroke="#00D4FF" stroke-width="3" opacity="0.7"/>` },

  // Eyewear — festival / EDM
  { id: "glasses-heart", name: "Heart Frames", slot: "glasses", priceCents: 150, svg: `<g>${heart(104, 132)}${heart(152, 132)}<path d="M121 132 H135" stroke="#CC00FF" stroke-width="3"/></g>` },
  { id: "glasses-visor", name: "Cyber Visor",  slot: "glasses", priceCents: 200, svg: `<g><rect x="80" y="121" width="96" height="20" rx="10" fill="#0a0a12"/><rect x="86" y="129" width="84" height="4" rx="2" fill="#39FF14"/><rect x="86" y="129" width="84" height="4" rx="2" fill="#39FF14" opacity="0.4"/></g>` },
  { id: "glasses-glow",  name: "Glowstick Shades", slot: "glasses", priceCents: 250, svg: `<g fill="none" stroke-linecap="round"><circle cx="104" cy="132" r="18" stroke="#39FF14" stroke-width="8" opacity="0.3"/><circle cx="152" cy="132" r="18" stroke="#00D4FF" stroke-width="8" opacity="0.3"/><circle cx="104" cy="132" r="18" stroke="#39FF14" stroke-width="3.5"/><circle cx="152" cy="132" r="18" stroke="#00D4FF" stroke-width="3.5"/><path d="M122 132 H134" stroke="#CC00FF" stroke-width="3.5"/></g>` },

  // Headwear — bandanas + more
  { id: "hat-headband", name: "Neon Headband", slot: "hat", priceCents: 0,   svg: `<rect x="60" y="104" width="136" height="10" rx="5" fill="#39FF14"/><rect x="60" y="104" width="136" height="10" rx="5" fill="#39FF14" opacity="0.4"/>` },
  { id: "hat-bandana",  name: "Bandana",       slot: "hat", priceCents: 0,   svg: `<path d="M62 112 Q128 92 194 112 L194 124 Q128 108 62 124 Z" fill="#c0392b"/><path d="M62 116 l-16 -4 l6 15 Z" fill="#962d22"/><g fill="#fff" opacity="0.55"><circle cx="92" cy="115" r="2"/><circle cx="128" cy="111" r="2"/><circle cx="164" cy="115" r="2"/></g>` },
  { id: "hat-bucket",   name: "Bucket Hat",    slot: "hat", priceCents: 150, svg: `<path d="M74 108 a54 32 0 0 1 108 0 Z" fill="#3a7d44"/><ellipse cx="128" cy="112" rx="74" ry="14" fill="#2f6337"/>` },
  { id: "hat-flower",   name: "Flower Crown",  slot: "hat", priceCents: 200, svg: `<path d="M64 114 Q128 96 192 114" fill="none" stroke="#3b7d3b" stroke-width="5"/>${flower(80, 108, "#FF6FB5")}${flower(112, 100, "#E8FF47")}${flower(146, 100, "#ffffff")}${flower(178, 108, "#7DD3FC")}` },
  { id: "hat-halo",     name: "Glow Halo",     slot: "hat", priceCents: 300, svg: `<g fill="none"><ellipse cx="128" cy="66" rx="52" ry="14" stroke="#00D4FF" stroke-width="10" opacity="0.3"/><ellipse cx="128" cy="66" rx="52" ry="14" stroke="#00D4FF" stroke-width="4"/></g>` },

  // Necklaces
  { id: "neck-none",  name: "None",  slot: "neck", priceCents: 0,   svg: `` },
  { id: "neck-kandi", name: "Kandi", slot: "neck", priceCents: 0,   svg: kandi() },
  { id: "neck-chain", name: "Chain", slot: "neck", priceCents: 100, svg: `<path d="M92 206 Q128 236 164 206" fill="none" stroke="#c9b037" stroke-width="4" stroke-linecap="round"/><path d="M92 206 Q128 236 164 206" fill="none" stroke="#fff3b0" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>` },
  { id: "neck-glow",  name: "Glowstick Necklace", slot: "neck", priceCents: 250, svg: `<g fill="none" stroke-linecap="round"><path d="M90 204 Q128 240 166 204" stroke="#00D4FF" stroke-width="10" opacity="0.28"/><path d="M90 204 Q128 240 166 204" stroke="#00D4FF" stroke-width="4"/></g><circle cx="108" cy="222" r="4" fill="#39FF14"/><circle cx="128" cy="229" r="4" fill="#CC00FF"/><circle cx="148" cy="222" r="4" fill="#E8FF47"/>` },
];

function skin(color: string): string {
  return `<ellipse cx="128" cy="142" rx="74" ry="80" fill="${color}"/><ellipse cx="60" cy="146" rx="11" ry="14" fill="${color}"/><ellipse cx="196" cy="146" rx="11" ry="14" fill="${color}"/>`;
}

function star(cx: number, cy: number): string {
  return `<path transform="translate(${cx - 12} ${cy - 12}) scale(0.5)" d="M24 2 L29 17 L45 17 L32 27 L37 43 L24 33 L11 43 L16 27 L3 17 L19 17 Z" fill="#E8FF47"/>`;
}

function heart(cx: number, cy: number): string {
  return `<path transform="translate(${cx - 13} ${cy - 11}) scale(0.95)" d="M13 7 C13 2 5 2 5 8 C5 13 13 16 13 20 C13 16 21 13 21 8 C21 2 13 2 13 7 Z" fill="#FF3EA5" opacity="0.5" stroke="#CC00FF" stroke-width="1.4"/>`;
}

function flower(cx: number, cy: number, color: string): string {
  const petals = [0, 1, 2, 3, 4]
    .map((i) => {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = (cx + 7 * Math.cos(a)).toFixed(1);
      const y = (cy + 7 * Math.sin(a)).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}"/>`;
    })
    .join("");
  return `<g>${petals}<circle cx="${cx}" cy="${cy}" r="3.5" fill="#E8FF47"/></g>`;
}

function kandi(): string {
  const cols = ["#39FF14", "#FF6FB5", "#E8FF47", "#7DD3FC", "#CC00FF", "#FF5C3A", "#39FF14"];
  const P: [number, number][] = [[92, 206], [128, 236], [164, 206]];
  const at = (t: number): [number, number] => {
    const u = 1 - t;
    return [
      u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0],
      u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1],
    ];
  };
  const beads = cols
    .map((c, i) => {
      const [x, y] = at(i / (cols.length - 1));
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${c}"/>`;
    })
    .join("");
  return `<path d="M92 206 Q128 236 164 206" fill="none" stroke="#444" stroke-width="1"/>${beads}`;
}

// ---- Lookups & composition --------------------------------------------

export const ITEM_BY_ID: Record<string, AvatarItem> =
  Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const DEFAULT_CONFIG: Record<Slot, string> = {
  background: "bg-void",
  base: "base-sand",
  neck: "neck-none",
  facial: "facial-none",
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
