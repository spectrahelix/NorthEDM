"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Square crop step for product photos. The vendor drags to frame the shot and
 * pinches (or uses the slider) to zoom; what is inside the square is exactly
 * what customers see, at every size, on every page.
 *
 * Square because every product grid on the site is square: one standard shape
 * means a tall phone photo and a wide one sit side by side evenly instead of
 * one stretching its card. Output is a JPEG of at most 1200×1200 (never
 * upscaled past the source's own detail).
 */
const OUT_MAX = 1200;

export function ImageCropper({ file, onDone, onCancel, remaining = 0 }: {
  file: File;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
  /** Photos still waiting after this one, for the "1 of 3" label. */
  remaining?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // Object URL for this file; sized to the screen once mounted.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const t = setTimeout(() => {
      setSrc(url);
      setView(Math.max(220, Math.min(380, window.innerWidth - 48)));
    }, 0);
    return () => { clearTimeout(t); URL.revokeObjectURL(url); };
  }, [file]);

  const base = nat ? Math.max(view / nat.w, view / nat.h) : 1;
  const scale = base * zoom;

  // Keep the square fully covered by the photo.
  function clamp(p: { x: number; y: number }, s = scale) {
    if (!nat) return p;
    const minX = view - nat.w * s, minY = view - nat.h * s;
    return { x: Math.min(0, Math.max(minX, p.x)), y: Math.min(0, Math.max(minY, p.y)) };
  }

  function onLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const w = e.currentTarget.naturalWidth, h = e.currentTarget.naturalHeight;
    setNat({ w, h });
    const s = Math.max(view / w, view / h);
    setPos({ x: (view - w * s) / 2, y: (view - h * s) / 2 }); // centred
  }

  // Zoom about a point in the square (the centre for the slider, the pinch midpoint for fingers).
  function zoomTo(next: number, cx = view / 2, cy = view / 2) {
    const z = Math.min(4, Math.max(1, next));
    const ns = base * z;
    setPos((p) => clamp({ x: cx - (cx - p.x) * (ns / scale), y: cy - (cy - p.y) * (ns / scale) }, ns));
    setZoom(z);
  }

  function down(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function move(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      zoomTo(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist),
        (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
    } else if (pointers.current.size === 1) {
      setPos((p) => clamp({ x: p.x + (cur.x - prev.x), y: p.y + (cur.y - prev.y) }));
    }
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  async function finish() {
    const img = imgRef.current;
    if (!img || !nat) return;
    setBusy(true);
    const side = view / scale;                      // source pixels inside the square
    const out = Math.max(1, Math.min(OUT_MAX, Math.round(side)));
    const canvas = document.createElement("canvas");
    canvas.width = out; canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setBusy(false); return; }
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, side, side, 0, 0, out, out);
    canvas.toBlob((b) => { setBusy(false); if (b) onDone(b); }, "image/jpeg", 0.88);
  }

  // Portalled to <body>: inside the inventory form, an ancestor's transform /
  // backdrop-filter made `fixed` position against the form instead of the
  // screen, pushing the dialog (and its "Use photo" button) off the edge.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-4" role="dialog" aria-label="Crop photo">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5">
        <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">
          Frame your photo{remaining > 0 ? ` · ${remaining} more after this` : ""}
        </p>
        <p className="mt-1 text-sm text-neutral-400">Drag to move, pinch or slide to zoom. The square is exactly what customers see.</p>

        <div
          className="relative mx-auto mt-4 touch-none select-none overflow-hidden rounded-xl bg-neutral-900"
          style={{ width: view, height: view }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={imgRef} src={src} alt="" draggable={false} onLoad={onLoad}
              className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
              style={{ width: nat?.w, height: nat?.h, transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, visibility: nat ? "visible" : "hidden" }} />
          )}
          {/* thirds grid */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/10" />)}
          </div>
        </div>

        <input type="range" min={1} max={4} step={0.01} value={zoom} aria-label="Zoom"
          onChange={(e) => zoomTo(Number(e.target.value))} className="mt-4 w-full" />

        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-400 hover:text-white">
            {remaining > 0 ? "Skip this one" : "Cancel"}
          </button>
          <button type="button" onClick={finish} disabled={!nat || busy}
            className="rounded-xl bg-[#39FF14] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50">
            {busy ? "Saving…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
