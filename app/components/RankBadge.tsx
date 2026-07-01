"use client";

import { ROLE_CONFIG, type ForumRole } from "./roleColors";

const ARTISAN_COLOR = "#FFC93C";

function ArtisanChip({ size }: { size: "sm" | "md" | "lg" }) {
  const chip = size === "lg" ? "text-[11px]" : "text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-dm-mono ${chip} uppercase tracking-widest`}
      style={{
        color: ARTISAN_COLOR,
        borderColor: `${ARTISAN_COLOR}55`,
        background: `${ARTISAN_COLOR}14`,
      }}
      title="Verified Artisan"
    >
      <span aria-hidden>◈</span> Artisan
    </span>
  );
}

export function RankBadge({
  role,
  name,
  size = "sm",
  isArtisan = false,
}: {
  role: string;
  name: string;
  size?: "sm" | "md" | "lg";
  isArtisan?: boolean;
}) {
  const config = ROLE_CONFIG[role as ForumRole] ?? ROLE_CONFIG.drifter;
  const textSize =
    size === "lg" ? "text-lg" : size === "md" ? "text-base" : "text-sm";
  const badgeSize = size === "lg" ? "text-[11px]" : "text-[10px]";

  if (config.effect === "sparkle") {
    return (
      <span className="relative inline-flex items-center gap-1.5">
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
        {isArtisan && <ArtisanChip size={size} />}
      </span>
    );
  }

  if (config.effect === "pulse") {
    return (
      <span className="inline-flex items-center gap-1.5">
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
        {isArtisan && <ArtisanChip size={size} />}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`font-semibold ${textSize}`} style={{ color: config.color }}>
        {name}
      </span>
      <span
        className={`font-dm-mono ${badgeSize} uppercase tracking-widest`}
        style={{ color: config.color, opacity: 0.45 }}
      >
        {config.label}
      </span>
      {isArtisan && <ArtisanChip size={size} />}
    </span>
  );
}
