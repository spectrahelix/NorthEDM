"use client";

import { useCallback, useEffect, useState } from "react";
import { setProductPhoto } from "@/utils/productPhoto";

type Photo = {
  bucket: string; path: string; url: string; uploadedAt: string | null; bytes: number | null;
  usedBy: { id: number; name: string }[]; displayable: boolean;
};

/**
 * Every photo this vendor has uploaded, and what each one is on. An upload
 * that never reached its item (a phone reloading mid-form) shows up here as
 * "not on any item", ready to use or delete — instead of vanishing.
 *
 * `version` lets the parent ask for a refresh after its own changes.
 */
export function PhotoLibrary({ products, onChanged, version = 0 }: {
  products: { id: number; name: string; source?: string | null }[];
  onChanged: () => void;
  version?: number;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/vendor/photos");
    const j = await res.json().catch(() => ({}));
    setPhotos(res.ok ? (j.photos ?? []) : []);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, version]);

  async function attachTo(p: Photo, productId: number) {
    setBusy(p.path); setMsg("");
    try {
      await setProductPhoto(productId, p.url);
      setMsg("Photo saved to that item.");
      onChanged();
      await load();
    } catch (x) {
      setMsg(x instanceof Error ? x.message : "Couldn't save that.");
    } finally { setBusy(null); }
  }

  async function remove(p: Photo) {
    if (!window.confirm("Delete this photo for good?")) return;
    setBusy(p.path); setMsg("");
    const res = await fetch("/api/vendor/photos", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket: p.bucket, path: p.path }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    setMsg(res.ok ? "Photo deleted." : j.error || "Couldn't delete that.");
    if (res.ok) await load();
  }

  const editable = products.filter((p) => p.source !== "square");

  return (
    <section className="mt-10">
      <h2 className="mb-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
        Your photos {photos ? `(${photos.length})` : ""}
      </h2>
      <p className="mb-3 text-xs text-neutral-500">Everything you&apos;ve uploaded, and which item shows it.</p>
      {photos === null ? (
        <p className="text-sm text-neutral-500">Loading your photos…</p>
      ) : photos.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">No photos uploaded yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {photos.map((p) => (
            <div key={p.bucket + p.path} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              {p.displayable ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-white/5 p-1 text-center font-dm-mono text-[9px] leading-tight text-orange-300">
                  iPhone format — most phones can&apos;t show it
                </div>
              )}
              <div className="min-w-0 flex-1 text-xs">
                <p className="text-neutral-400">
                  {p.uploadedAt ? new Date(p.uploadedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                  {p.bytes ? ` · ${Math.max(1, Math.round(p.bytes / 1024))} KB` : ""}
                </p>
                {p.usedBy.length ? (
                  <p className="mt-1 text-[#39FF14]">On: {p.usedBy.map((u) => u.name).join(", ")}</p>
                ) : (
                  <p className="mt-1 text-[#FFC93C]">Not on any item</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {editable.length > 0 && (
                    <select value="" disabled={busy === p.path}
                      onChange={(e) => e.target.value && attachTo(p, Number(e.target.value))}
                      className="max-w-[11rem] rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-200">
                      <option value="">Use on an item…</option>
                      {editable.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  )}
                  {!p.usedBy.length && (
                    <button type="button" onClick={() => remove(p)} disabled={busy === p.path}
                      className="rounded-lg border border-[#FF5C3A]/30 px-2 py-1 text-xs text-[#FF5C3A] transition hover:bg-[#FF5C3A]/10 disabled:opacity-50">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="mt-2 font-dm-mono text-xs text-neutral-400">{msg}</p>}
    </section>
  );
}
