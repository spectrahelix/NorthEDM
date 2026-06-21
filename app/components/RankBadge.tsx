"use client";

import { ROLE_CONFIG, type ForumRole } from "./roleColors";

export function RankBadge({
  role,
  name,
  size = "sm",
}: {
  role: string;
  name: string;
  size?: "sm" | "md" | "lg";
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
    </span>
  );
}
