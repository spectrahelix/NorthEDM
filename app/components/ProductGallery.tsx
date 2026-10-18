"use client";

import { useRef, useState } from "react";
import { ProductThumb } from "@/app/components/ProductThumb";

/**
 * Public photo gallery for one item: swipe (or tap the dots/thumbnails)
 * through square photos. Native scroll-snap, so it swipes like a phone's own
 * photo viewer with no library.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (images.length === 0) return <ProductThumb src={null} className="rounded-2xl" />;

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={src + i} className="w-full shrink-0 snap-center">
            <ProductThumb src={src} alt={`${alt} — photo ${i + 1} of ${images.length}`} />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <div className="mt-3 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button key={i} type="button" aria-label={`Photo ${i + 1}`} onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/30"}`} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {images.map((src, i) => (
              <button key={src + i} type="button" onClick={() => go(i)} aria-label={`Show photo ${i + 1}`}
                className={`overflow-hidden rounded-lg border ${i === index ? "border-white/70" : "border-white/10 opacity-70"}`}>
                <ProductThumb src={src} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
