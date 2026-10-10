"use client";

import { useRef, useState } from "react";
import { ACCEPT_WEB_IMAGES, toWebImage } from "@/utils/webImage";
import { setProductPhoto, uploadProductPhoto } from "@/utils/productPhoto";

/**
 * One-tap "Change photo" on an item in the inventory list. Uploads and saves
 * the photo onto that item in one step — no form involved, so a phone
 * reloading the page after its photo picker has nothing to lose.
 */
export function QuickPhotoButton({ productId, onSaved, label = "Change photo" }: {
  productId: number;
  onSaved: () => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setBusy(true); setErr("");
    try {
      const url = await uploadProductPhoto(await toWebImage(picked));
      await setProductPhoto(productId, url);
      onSaved();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col">
      <input ref={ref} type="file" accept={ACCEPT_WEB_IMAGES} className="hidden" onChange={pick} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5 disabled:opacity-50">
        {busy ? "Saving photo…" : label}
      </button>
      {err && <span className="mt-1 max-w-[12rem] text-[11px] text-[#FF5C3A]">{err}</span>}
    </span>
  );
}
