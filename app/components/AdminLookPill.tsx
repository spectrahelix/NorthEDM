"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STORE_THEMES } from "@/utils/storeThemes";
import { SHOP_FONT_CHOICES, lookPreviewCookie } from "@/utils/storeFonts";

/**
 * NorthEDM-admin-only control on a store page: flip through the curated
 * themes and fonts and see each one live on the real page, then Save the
 * pair as the store's look. Previews live in a cookie only this admin's
 * browser sends, and the server honours it only for admins — operators and
 * guests keep seeing the saved look until Save.
 */
export function AdminLookPill({ slug, savedTheme, savedFont, theme, font }: {
  slug: string; savedTheme: string; savedFont: string | null; theme: string; font: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const cookie = lookPreviewCookie(slug);
  const fonts: (string | null)[] = [null, ...SHOP_FONT_CHOICES.map((f) => f.key)];
  const dirty = theme !== savedTheme || font !== savedFont;

  function preview(nextTheme: string, nextFont: string | null) {
    setMsg("");
    document.cookie = `${cookie}=${encodeURIComponent(`${nextTheme}|${nextFont ?? ""}`)}; path=/; max-age=86400; samesite=lax`;
    start(() => router.refresh());
  }
  const step = <T,>(list: T[], cur: T, d: number) => list[(list.indexOf(cur) + d + list.length) % list.length];

  async function save() {
    const res = await fetch("/api/admin/stores", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, theme, font }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(j.error || "Couldn't save."); return; }
    document.cookie = `${cookie}=; path=/; max-age=0`;
    setMsg("Saved — this is now the store's look.");
    start(() => router.refresh());
  }
  function reset() {
    document.cookie = `${cookie}=; path=/; max-age=0`;
    setMsg("");
    start(() => router.refresh());
  }

  const themeLabel = STORE_THEMES.find((t) => t.key === theme)?.label ?? theme;
  const fontLabel = SHOP_FONT_CHOICES.find((f) => f.key === font)?.label ?? "Standard";
  const btn = "h-7 w-7 rounded-full text-neutral-300 hover:bg-white/10 disabled:opacity-40";

  return (
    <div className="mt-5 inline-flex flex-col gap-2 rounded-2xl border border-[#FFC93C]/30 bg-black/50 p-3 backdrop-blur">
      <p className="font-dm-mono text-[10px] uppercase tracking-widest text-[#FFC93C]">Admin · store look {pending ? "…" : dirty ? "(preview — not saved)" : "(saved)"}</p>
      <div className="flex items-center gap-1 text-sm">
        <span className="w-12 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Theme</span>
        <button type="button" aria-label="Previous theme" className={btn} disabled={pending} onClick={() => preview(step(STORE_THEMES.map((t) => t.key), theme, -1), font)}>◀</button>
        <span className="min-w-[9rem] text-center text-white">{themeLabel}</span>
        <button type="button" aria-label="Next theme" className={btn} disabled={pending} onClick={() => preview(step(STORE_THEMES.map((t) => t.key), theme, 1), font)}>▶</button>
      </div>
      <div className="flex items-center gap-1 text-sm">
        <span className="w-12 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Font</span>
        <button type="button" aria-label="Previous font" className={btn} disabled={pending} onClick={() => preview(theme, step(fonts, font, -1))}>◀</button>
        <span className="min-w-[9rem] text-center text-white">{fontLabel}</span>
        <button type="button" aria-label="Next font" className={btn} disabled={pending} onClick={() => preview(theme, step(fonts, font, 1))}>▶</button>
      </div>
      {dirty && (
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-[#FFC93C] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90">Save this look</button>
          <button type="button" onClick={reset} disabled={pending} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5">Back to saved</button>
        </div>
      )}
      {msg && <p className="font-dm-mono text-[10px] text-neutral-400">{msg}</p>}
    </div>
  );
}
