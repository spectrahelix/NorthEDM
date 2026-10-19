"use client";

import { useRef, useState } from "react";
import { ACCEPT_WEB_IMAGES, toWebImage } from "@/utils/webImage";

/** Upload / replace / remove a store's logo (operator or NorthEDM admin). */
export function StoreLogoUpload({ slug, logoUrl, onChanged }: { slug: string; logoUrl: string | null; onChanged: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (!picked) return;
    setBusy(true); setErr("");
    // keepTransparency: a see-through logo stays see-through on the store's theme.
    const file = await toWebImage(picked, { keepTransparency: true });
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`/api/store/${slug}/logo`, { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error || "Upload failed."); return; }
    onChanged();
  }

  async function remove() {
    if (!window.confirm("Remove your store's logo?")) return;
    setBusy(true); setErr("");
    const res = await fetch(`/api/store/${slug}/logo`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onChanged(); else setErr("Couldn't remove it.");
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Store logo" className="h-full w-full object-contain" />
        ) : (
          <span className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">No logo</span>
        )}
      </div>
      <input ref={ref} type="file" accept={ACCEPT_WEB_IMAGES} className="hidden" onChange={pick} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50">
        {busy ? "Working…" : logoUrl ? "Change logo" : "Upload logo"}
      </button>
      {logoUrl && !busy && (
        <button type="button" onClick={remove} className="font-dm-mono text-xs text-[#FF5C3A] hover:underline">Remove</button>
      )}
      {err && <p className="w-full text-sm text-[#FF5C3A]">{err}</p>}
    </div>
  );
}
