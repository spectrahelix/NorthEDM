"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadBrowserSam } from "@/utils/productStudio/loadBrowser";
import { maskFor, prepare, type Prepared, type Tap } from "@/utils/productStudio/segment";
import { cleanMask, composeStudio, STUDIO_SIZE } from "@/utils/productStudio/compose";
import { BACKDROPS, DEFAULT_BACKDROP, backdropById, backdropCss } from "@/utils/productStudio/backdrops";

/**
 * Studio photo: the shop owner taps their item, it is cut out of the photo
 * (hand, table and all) and set on a clean backdrop — a square 1200×1200 JPEG,
 * the same shape ImageCropper produces, handed to the same upload.
 *
 * Everything runs on the owner's device (utils/productStudio/*). The agent
 * skill (.claude/skills/product-photo) runs the same code from the command line.
 */
const WORK_MAX = 1200; // working resolution: plenty for a 1200 square, quick on phones

type Work = { rgba: Uint8ClampedArray; W: number; H: number };

export function PhotoStudio({ file, onDone, onBack, remaining = 0 }: {
  file: File;
  onDone: (blob: Blob) => void;
  /** Back to the plain square crop. */
  onBack: () => void;
  remaining?: number;
}) {
  const [status, setStatus] = useState("Starting Studio…");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"select" | "backdrop">("select");
  const [taps, setTaps] = useState<Tap[]>([]);
  const [adding, setAdding] = useState(true);
  const [alpha, setAlpha] = useState<Uint8ClampedArray | null>(null);
  const [backdrop, setBackdrop] = useState(DEFAULT_BACKDROP);
  const [view, setView] = useState(300);
  const [saving, setSaving] = useState(false);
  const [dims, setDims] = useState<{ W: number; H: number } | null>(null);
  const [ready, setReady] = useState(false);
  const work = useRef<Work | null>(null);
  const prepared = useRef<Prepared | null>(null);
  const selectRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Decode the photo, load the model, run the image encoder, first guess at the centre.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setView(Math.max(220, Math.min(380, window.innerWidth - 80))); // dialog padding + border
        const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
        const s = Math.min(1, WORK_MAX / Math.max(bmp.width, bmp.height));
        const W = Math.round(bmp.width * s), H = Math.round(bmp.height * s);
        const c = document.createElement("canvas"); c.width = W; c.height = H;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0, W, H);
        bmp.close?.();
        const rgba = ctx.getImageData(0, 0, W, H).data;
        work.current = { rgba, W, H };
        setDims({ W, H });

        setStatus("Loading smart select… (first time only, about 14 MB)");
        const sam = await loadBrowserSam((pct) => live && setStatus(`Loading smart select… ${Math.round(pct)}%`));
        if (!live) return;
        setStatus("Looking at your photo…");
        await new Promise((r) => setTimeout(r, 30)); // let the message paint before the heavy step
        const rgb = new Uint8ClampedArray(W * H * 3);
        for (let i = 0; i < W * H; i++) { rgb[i * 3] = rgba[i * 4]; rgb[i * 3 + 1] = rgba[i * 4 + 1]; rgb[i * 3 + 2] = rgba[i * 4 + 2]; }
        prepared.current = await prepare(sam, new sam.tf.RawImage(rgb, W, H, 3));
        if (!live) return;
        setReady(true);
        setTaps([{ x: W / 2, y: H / 2, add: true }]); // products are usually in the middle
      } catch (e) {
        console.error("PhotoStudio", e);
        if (live) setError("Studio couldn't start on this device or connection. You can still use the plain crop.");
      }
    })();
    return () => {
      live = false;
      for (const t of Object.values(prepared.current?.embeddings ?? {})) t.dispose?.();
    };
  }, [file]);

  // Every change of taps → new selection.
  useEffect(() => {
    const p = prepared.current, w = work.current;
    if (!p || !w || !taps.length) return;
    let live = true;
    (async () => {
      setStatus("Selecting…");
      try {
        if (!taps.some((t) => t.add)) { setAlpha(null); setStatus(""); return; }
        const { mask } = await maskFor(p, taps);
        if (!live) return;
        setAlpha(cleanMask(mask, w.W, w.H, taps.filter((t) => t.add), w.rgba));
        setStatus("");
      } catch (e) {
        console.error("PhotoStudio select", e);
        if (live) setStatus("That didn't work — try tapping again.");
      }
    })();
    return () => { live = false; };
  }, [taps]);

  // Draw the selection: everything outside dimmed, taps as dots.
  useEffect(() => {
    const c = selectRef.current, w = work.current;
    if (!c || !w || step !== "select") return;
    c.width = w.W; c.height = w.H;
    const ctx = c.getContext("2d")!;
    const img = new ImageData(new Uint8ClampedArray(w.rgba), w.W, w.H);
    if (alpha) {
      const d = img.data;
      for (let i = 0; i < w.W * w.H; i++) {
        const k = 0.28 + 0.72 * (alpha[i] / 255);
        d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k;
      }
    }
    ctx.putImageData(img, 0, 0);
    const r = Math.max(6, w.W / 70);
    for (const t of taps) {
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fillStyle = t.add ? "#39FF14" : "#FF5C3A"; ctx.fill();
      ctx.lineWidth = r / 3; ctx.strokeStyle = "#000"; ctx.stroke();
    }
  }, [alpha, taps, step]);

  const render = useCallback((size: number) => {
    const w = work.current;
    if (!w || !alpha) return null;
    const px = composeStudio({ rgba: w.rgba, W: w.W, H: w.H, alpha, backdrop: backdropById(backdrop), size });
    return new ImageData(new Uint8ClampedArray(px), size, size);
  }, [alpha, backdrop]);

  // Preview on the chosen backdrop (smaller, so switching colours is instant).
  useEffect(() => {
    const c = previewRef.current;
    if (!c || step !== "backdrop") return;
    const img = render(600);
    if (!img) return;
    c.width = 600; c.height = 600;
    c.getContext("2d")!.putImageData(img, 0, 0);
  }, [render, step]);

  function tap(e: React.MouseEvent<HTMLCanvasElement>) {
    const w = work.current;
    if (!w || !prepared.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w.W;
    const y = ((e.clientY - rect.top) / rect.height) * w.H;
    setTaps((t) => [...t, { x, y, add: adding }]);
  }

  async function finish() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 30));
    const img = render(STUDIO_SIZE);
    if (!img) { setSaving(false); return; }
    const c = document.createElement("canvas"); c.width = STUDIO_SIZE; c.height = STUDIO_SIZE;
    c.getContext("2d")!.putImageData(img, 0, 0);
    c.toBlob((b) => { setSaving(false); if (b) onDone(b); }, "image/jpeg", 0.88);
  }

  const box = !dims ? { width: view, height: view }
    : dims.W >= dims.H ? { width: view, height: (view * dims.H) / dims.W } : { width: (view * dims.W) / dims.H, height: view };
  const btn = "rounded-xl border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-40";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-4" role="dialog" aria-label="Studio photo">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5">
        <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">
          ✨ Studio photo · {step === "select" ? "1 Select your item" : "2 Pick a background"}
          {remaining > 0 ? ` · ${remaining} more after this` : ""}
        </p>

        {error ? (
          <p className="mt-3 text-sm text-[#FF5C3A]">{error}</p>
        ) : step === "select" ? (
          <>
            <p className="mt-1 text-sm text-neutral-400">
              {adding
                ? "Tap your item. Part of it missing? Tap the missing parts too — top, middle and bottom works best."
                : "Tap anything that isn't the item — a finger, the table — to take it out."}
            </p>
            <div className="relative mx-auto mt-3 overflow-hidden rounded-xl bg-neutral-900" style={box}>
              <canvas ref={selectRef} onClick={tap} className="h-full w-full cursor-crosshair touch-manipulation" />
              {status && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-center text-xs text-neutral-200">{status}</div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-xl border border-white/10 text-xs">
                <button type="button" onClick={() => setAdding(true)}
                  className={`px-3 py-1.5 ${adding ? "bg-[#39FF14] font-semibold text-black" : "text-neutral-300"}`}>+ Item</button>
                <button type="button" onClick={() => setAdding(false)}
                  className={`px-3 py-1.5 ${!adding ? "bg-[#FF5C3A] font-semibold text-black" : "text-neutral-300"}`}>− Not item</button>
              </div>
              <button type="button" className={btn} disabled={taps.length < 2} onClick={() => setTaps((t) => t.slice(0, -1))}>Undo</button>
              <button type="button" className={btn} disabled={!ready || !!error} onClick={() => { setAdding(true); setTaps([]); setAlpha(null); }}>Start over</button>
            </div>
          </>
        ) : (
          <>
            <canvas ref={previewRef} className="mx-auto mt-3 rounded-xl" style={{ width: view, height: view }} />
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Background">
              {BACKDROPS.map((b) => (
                <button key={b.id} type="button" role="radio" aria-checked={backdrop === b.id} aria-label={b.label} title={b.label}
                  onClick={() => setBackdrop(b.id)}
                  className={`h-9 w-9 rounded-full border-2 ${backdrop === b.id ? "border-[#39FF14]" : "border-white/15"}`}
                  style={{ background: backdropCss(b) }} />
              ))}
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          {step === "select" ? (
            <>
              <button type="button" onClick={onBack} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-400 hover:text-white">
                Plain crop instead
              </button>
              <button type="button" onClick={() => setStep("backdrop")} disabled={!alpha || !!status}
                className="rounded-xl bg-[#39FF14] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50">
                Next: background
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setStep("select")} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-400 hover:text-white">
                Back
              </button>
              <button type="button" onClick={finish} disabled={saving}
                className="rounded-xl bg-[#39FF14] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50">
                {saving ? "Saving…" : "Use photo"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
