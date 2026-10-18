"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCEPT_WEB_IMAGES, toWebImage } from "@/utils/webImage";
import { addProductImage, uploadProductPhoto, type GalleryImage } from "@/utils/productPhoto";
import { ImageCropper } from "./ImageCropper";
import { ProductThumb } from "@/app/components/ProductThumb";

/**
 * An item's photo gallery, for its vendor: add any number of photos (each
 * framed square in ImageCropper), reorder, choose the main one, remove.
 * The first photo is the thumbnail everywhere on the site.
 *
 * `ensureProductId` handles a brand-new item: it must save the typed details
 * to the server and resolve to the new id. It's called synchronously in the
 * tap, before the photo picker opens — phones can discard the page while the
 * picker is up, and the details must already be safe by then. Return null to
 * refuse (the caller shows why, e.g. no name typed yet).
 */
export function GalleryManager({ productId, ensureProductId, onChanged }: {
  productId: number | null;
  ensureProductId: () => Promise<number | null> | null;
  onChanged?: (images: GalleryImage[]) => void;
}) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [queue, setQueue] = useState<File[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<Promise<number | null> | null>(null);
  const onChangedRef = useRef(onChanged);
  useEffect(() => { onChangedRef.current = onChanged; });

  const apply = useCallback((next: GalleryImage[]) => {
    setImages(next);
    onChangedRef.current?.(next);
  }, []);

  useEffect(() => {
    if (!productId) { const t = setTimeout(() => setImages([]), 0); return () => clearTimeout(t); }
    let live = true;
    fetch(`/api/vendor/products/${productId}/images`).then((r) => r.json()).then((j) => {
      if (live) setImages(j.images ?? []);
    }).catch(() => {});
    return () => { live = false; };
  }, [productId]);

  function openPicker() {
    setErr("");
    const id = productId ? Promise.resolve(productId) : ensureProductId();
    if (!id) return;
    idRef.current = id;
    fileRef.current?.click();
  }

  async function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setBusy("Preparing photos…");
    const ready: File[] = [];
    for (const f of files) ready.push(await toWebImage(f)); // HEIC → JPEG, sized down
    setBusy("");
    setQueue(ready);
  }

  async function cropped(blob: Blob) {
    const [, ...rest] = queue;
    setQueue(rest);
    setBusy("Uploading…");
    try {
      const url = await uploadProductPhoto(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const id = (await idRef.current) ?? productId;
      if (!id) throw new Error("Save the item first, then add photos.");
      apply(await addProductImage(id, url));
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Upload failed.");
    } finally {
      setBusy("");
    }
  }

  async function reorder(order: number[]) {
    if (!productId) return;
    setBusy("Saving order…"); setErr("");
    const res = await fetch(`/api/vendor/products/${productId}/images`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ order }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) apply(j.images); else setErr(j.error || "Couldn't reorder.");
  }

  async function remove(img: GalleryImage) {
    if (!productId || !window.confirm("Remove this photo from the item? It stays in Your photos.")) return;
    setBusy("Removing…"); setErr("");
    const res = await fetch(`/api/vendor/products/${productId}/images`, {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageId: img.id }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) apply(j.images); else setErr(j.error || "Couldn't remove.");
  }

  const ids = images.map((i) => i.id);
  const move = (i: number, to: number) => {
    const next = [...ids];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    reorder(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Photos {images.length ? `(${images.length})` : ""}
        </p>
        <button type="button" onClick={openPicker} disabled={!!busy}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/5 disabled:opacity-50">
          {busy || "+ Add photos"}
        </button>
      </div>
      <input ref={fileRef} type="file" accept={ACCEPT_WEB_IMAGES} multiple className="hidden" onChange={picked} />

      {images.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-500">No photos yet. Add as many as you like — the first is the main photo customers see in lists.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="relative">
                <ProductThumb src={img.url} />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 font-dm-mono text-[10px] text-[#39FF14]">MAIN</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                <button type="button" aria-label="Move left" disabled={i === 0 || !!busy} onClick={() => move(i, i - 1)}
                  className="h-7 w-7 rounded-md text-neutral-400 hover:bg-white/10 disabled:opacity-20">◀</button>
                {i !== 0 && (
                  <button type="button" disabled={!!busy} onClick={() => move(i, 0)}
                    className="rounded-md px-1 font-dm-mono text-[10px] text-neutral-300 hover:bg-white/10">Main</button>
                )}
                <button type="button" aria-label="Move right" disabled={i === images.length - 1 || !!busy} onClick={() => move(i, i + 1)}
                  className="h-7 w-7 rounded-md text-neutral-400 hover:bg-white/10 disabled:opacity-20">▶</button>
                <button type="button" aria-label="Remove photo" disabled={!!busy} onClick={() => remove(img)}
                  className="h-7 w-7 rounded-md text-[#FF5C3A] hover:bg-[#FF5C3A]/10">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {err && <p className="mt-2 text-sm text-[#FF5C3A]">{err}</p>}

      {queue[0] && (
        <ImageCropper key={queue.length} file={queue[0]} remaining={queue.length - 1}
          onDone={cropped} onCancel={() => setQueue((q) => q.slice(1))} />
      )}
    </div>
  );
}
