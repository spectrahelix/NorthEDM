"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SHOP_FONTS_COOKIE } from "@/utils/storeFonts";

/**
 * The visitor's own switch: show each shop's custom font, or standard NorthEDM
 * fonts everywhere. Remembered on this device for a year (a cookie, so the
 * server renders the right fonts on the first paint — no flash of the wrong
 * style). Shop themes/backgrounds are unaffected; this is fonts only.
 */
export function ShopFontToggle({ enabled, className = "" }: { enabled: boolean; className?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function flip() {
    const next = !on;
    setOn(next);
    document.cookie = `${SHOP_FONTS_COOKIE}=${next ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={flip}
      disabled={pending}
      title={on ? "Showing each shop's own font — tap for standard fonts" : "Showing standard fonts — tap to see each shop's own font"}
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-300 backdrop-blur transition hover:bg-white/5 ${className}`}
    >
      <span className={`relative h-4 w-7 rounded-full transition ${on ? "bg-[#39FF14]/80" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
      Shop fonts {on ? "on" : "off"}
    </button>
  );
}
