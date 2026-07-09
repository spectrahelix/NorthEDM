"use client";

import { ROLE_CONFIG, TAG_CONFIG, type ForumRole, type TagKey } from "./roleColors";

function TagChip({ tagKey, size }: { tagKey: TagKey; size: "sm" | "md" | "lg" }) {
  const t = TAG_CONFIG[tagKey];
  const chip = size === "lg" ? "text-[11px]" : "text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-dm-mono ${chip} uppercase tracking-widest`}
      style={{ color: t.color, borderColor: `${t.color}55`, background: `${t.color}14` }}
      title={t.label}
    >
      <span aria-hidden>{t.glyph}</span> {t.label}
    </span>
  );
}

export function RankBadge({
  role,
  name,
  size = "sm",
  tags = [],
}: {
  role: string;
  name: string;
  size?: "sm" | "md" | "lg";
  tags?: TagKey[];
}) {
  const config = ROLE_CONFIG[role as ForumRole] ?? ROLE_CONFIG.drifter;
  const textSize =
    size === "lg" ? "text-lg" : size === "md" ? "text-base" : "text-sm";
  const badgeSize = size === "lg" ? "text-[11px]" : "text-[10px]";
  const chips = tags.map((t) => <TagChip key={t} tagKey={t} size={size} />);

  if (config.effect === "sparkle") {
    return (
      <span className="relative inline-flex flex-wrap items-center gap-1.5">
        <span
          className={`rank-sparkle font-semibold ${textSize}`}
          style={{ "--rank-color": config.color } as React.CSSProperties}
        >
          {name}
        </span>
        <span
          className={`font-dm-mono ${badgeSize} uppercase tracking-widest`}
          style={{ color: config.color, opacity: 0.7 }}
        >
          {config.label}
        </span>
        <span className="sparkle-star s1" style={{ color: config.color }}>✦</span>
        <span className="sparkle-star s2" style={{ color: config.color }}>·</span>
        <span className="sparkle-star s3" style={{ color: config.color }}>✧</span>
        {chips}
      </span>
    );
  }

  if (config.effect === "pulse") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span
          className={`rank-pulse font-semibold ${textSize}`}
          style={{ color: config.color }}
        >
          {name}
        </span>
        <span
          className={`font-dm-mono ${badgeSize} uppercase tracking-widest`}
          style={{ color: config.color, opacity: 0.55 }}
        >
          {config.label}
        </span>
        {chips}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`font-semibold ${textSize}`} style={{ color: config.color }}>
        {name}
      </span>
      <span
        className={`font-dm-mono ${badgeSize} uppercase tracking-widest`}
        style={{ color: config.color, opacity: 0.45 }}
      >
        {config.label}
      </span>
      {chips}
    </span>
  );
}
