"use client";
import { TAG_CONFIG, type TagKey } from "./roleColors";

export function TagChip({ tagKey, size = "sm" }: { tagKey: TagKey; size?: "sm" | "md" | "lg" }) {
  const t = TAG_CONFIG[tagKey];
  const chip = size === "lg" ? "text-[11px]" : "text-[10px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-dm-mono ${chip} uppercase tracking-widest`}
      style={{ color: t.color, borderColor: `${t.color}55`, background: `${t.color}14` }} title={t.label}>
      <span aria-hidden>{t.glyph}</span> {t.label}
    </span>
  );
}

export function TagChips({ tags, size = "sm" }: { tags: TagKey[]; size?: "sm" | "md" | "lg" }) {
  if (!tags.length) return null;
  return <span className="inline-flex flex-wrap items-center gap-1.5">{tags.map((t) => <TagChip key={t} tagKey={t} size={size} />)}</span>;
}
