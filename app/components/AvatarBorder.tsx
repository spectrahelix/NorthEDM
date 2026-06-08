"use client";

export type BorderKey =
  | "moss"
  | "mycelium"
  | "ember"
  | "tide"
  | "bone"
  | "aurora"
  | "obsidian"
  | "spore";

export const BORDER_OPTIONS: {
  key: BorderKey;
  name: string;
  description: string;
}[] = [
  { key: "moss",     name: "Forest Moss",  description: "Organic animated green ring" },
  { key: "mycelium", name: "Mycelium Web", description: "Threadlike network on dark" },
  { key: "ember",    name: "Ember Ring",   description: "Slow orange-red glow pulse" },
  { key: "tide",     name: "Tide Pool",    description: "Blue-green water shimmer" },
  { key: "bone",     name: "Bone & Root",  description: "Pale interlocking root ring" },
  { key: "aurora",   name: "Aurora",       description: "Shifting purple-green halo" },
  { key: "obsidian", name: "Obsidian",     description: "Dark stone with subtle ring" },
  { key: "spore",    name: "Spore Cloud",  description: "Floating particle dots" },
];

type BorderStyle = {
  primary: string;
  secondary: string;
  animClass: string;
  dasharray?: string;
  gradient?: boolean;
};

const STYLES: Record<BorderKey, BorderStyle> = {
  moss:     { primary: "#4ade80", secondary: "#166534", animClass: "avatar-ring-rotate",       dasharray: "8 4" },
  mycelium: { primary: "#d4d4d4", secondary: "#525252", animClass: "avatar-ring-pulse",        dasharray: "2 7" },
  ember:    { primary: "#f97316", secondary: "#dc2626", animClass: "avatar-ring-pulse-slow",   gradient: true },
  tide:     { primary: "#22d3ee", secondary: "#0ea5e9", animClass: "avatar-ring-rotate-slow",  dasharray: "14 4" },
  bone:     { primary: "#e5d5b0", secondary: "#a89070", animClass: "avatar-ring-pulse",        dasharray: "6 9" },
  aurora:   { primary: "#a855f7", secondary: "#4ade80", animClass: "avatar-ring-rotate",       gradient: true },
  obsidian: { primary: "#6b7280", secondary: "#374151", animClass: "avatar-ring-pulse-slow",   dasharray: "3 5" },
  spore:    { primary: "#d8b4fe", secondary: "#7c3aed", animClass: "avatar-ring-pulse",        dasharray: "1 10" },
};

export function AvatarBorder({
  border,
  size = 44,
  children,
}: {
  border: string;
  size?: number;
  children: React.ReactNode;
}) {
  const key: BorderKey = border in STYLES ? (border as BorderKey) : "moss";
  const s = STYLES[key];
  const r = size / 2;
  const innerR = r - 3;
  const outerR = r - 1.5;
  const gradId = `grad-${key}`;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        {children}
      </div>
      <svg
        className={`pointer-events-none absolute inset-0 ${s.animClass}`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        style={{ overflow: "visible" }}
      >
        {s.gradient && (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={s.primary} />
              <stop offset="50%"  stopColor={s.secondary} />
              <stop offset="100%" stopColor={s.primary} />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={r}
          cy={r}
          r={innerR}
          stroke={s.gradient ? `url(#${gradId})` : s.primary}
          strokeWidth="2.5"
          strokeDasharray={s.dasharray}
          opacity="0.9"
        />
        {!s.gradient && (
          <circle
            cx={r}
            cy={r}
            r={outerR}
            stroke={s.secondary}
            strokeWidth="1"
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dasharray ? "12" : undefined}
            opacity="0.25"
          />
        )}
      </svg>
    </div>
  );
}

export function BorderPreview({ borderKey, active }: { borderKey: BorderKey; active: boolean }) {
  const s = STYLES[borderKey];
  const size = 36;
  const r = 18;
  const innerR = 15;
  const gradId = `prev-${borderKey}`;
  const opt = BORDER_OPTIONS.find((o) => o.key === borderKey)!;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition ${
        active ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
      }`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/5 text-xs text-neutral-400">
          Ab
        </div>
        <svg
          className={`pointer-events-none absolute inset-0 ${s.animClass}`}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
        >
          {s.gradient && (
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor={s.primary} />
                <stop offset="50%"  stopColor={s.secondary} />
                <stop offset="100%" stopColor={s.primary} />
              </linearGradient>
            </defs>
          )}
          <circle
            cx={r}
            cy={r}
            r={innerR}
            stroke={s.gradient ? `url(#${gradId})` : s.primary}
            strokeWidth="2"
            strokeDasharray={s.dasharray}
            opacity="0.9"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm text-neutral-200">{opt.name}</p>
        <p className="text-xs text-neutral-500">{opt.description}</p>
      </div>
    </div>
  );
}
