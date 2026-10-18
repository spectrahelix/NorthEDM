"use client";

import { useState } from "react";

/**
 * The one way an item photo is drawn in any list on the site: a square,
 * cropped to fill, with a placeholder when there is no photo or it fails to
 * load (a broken-image icon with alt text was showing on the FestDash menu).
 */
export function ProductThumb({ src, alt = "", className = "" }: { src?: string | null; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-white/[0.04] ${className}`}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
          {src ? "Photo unavailable" : "No photo"}
        </div>
      )}
    </div>
  );
}
