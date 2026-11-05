"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Honeypot, useFormShield } from "@/app/components/FormShield";

/**
 * "QTY Not Listed? → request now" (owner, 2026-11-05): a small box on each
 * store card. A shopper asks for a size or quantity that isn't on sale; the
 * shop's operator is alerted and sees it in Edit shop. Push guard: one request
 * per person per size — the server refuses a second (409) and the box then
 * reads "Requested ✓" for good.
 */
type Size = { id: number; label: string };

export function ItemRequest({ slug, sizes, defaultId, requested, signedIn, accent, onSent }: {
  slug: string;
  sizes: Size[];
  defaultId: number;
  /** Sizes this shopper already asked for. */
  requested: Set<number>;
  signedIn: boolean | null;
  accent: string;
  onSent: (id: number) => void;
}) {
  const { shield, honeypot } = useFormShield();
  const router = useRouter();
  const toLogin = () => router.push(`/login?next=${encodeURIComponent(`/${slug}`)}`);
  const [open, setOpen] = useState(false);
  const [sizeId, setSizeId] = useState(defaultId);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const allAsked = sizes.every((s) => requested.has(s.id));
  const target = requested.has(sizeId) ? sizes.find((s) => !requested.has(s.id))?.id ?? sizeId : sizeId;

  if (allAsked || (sizes.length === 1 && requested.has(defaultId))) {
    return <p className="mt-2 rounded-lg border border-white/10 px-2 py-1.5 text-center font-dm-mono text-[10px] text-neutral-400">Requested ✓ — the shop has it</p>;
  }

  async function send() {
    const q = Math.floor(Number(quantity));
    if (!(q >= 1)) { setError("How many?"); return; }
    setBusy(true); setError("");
    const res = await fetch(`/api/store/${slug}/requests`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: target, quantity: q, note, ...shield() }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.status === 401) { toLogin(); return; }
    if (res && (res.ok || res.status === 409)) { onSent(target); setOpen(false); setQuantity(""); setNote(""); return; }
    setError((j as { error?: string }).error || "Couldn't send that — try again.");
  }

  // Sizes already asked for stay visible on the card, so a sent request never looks lost.
  const asked = sizes.filter((s) => requested.has(s.id)).map((s) => s.label);
  const askedNote = asked.length > 0 && (
    <p className="mt-2 text-center font-dm-mono text-[10px] text-neutral-400">Requested ✓ {asked.join(", ")}</p>
  );

  if (!open) {
    return (
      <>
      {askedNote}
      <button type="button" onClick={() => (signedIn === false ? toLogin() : setOpen(true))}
        className="mt-2 w-full rounded-lg border border-dashed border-white/20 px-2 py-1 text-center leading-tight transition hover:border-white/40 hover:bg-white/[0.04]">
        <span className="block text-[11px] font-semibold text-neutral-300">QTY Not Listed?</span>
        <span className="block font-dm-mono text-[10px]" style={{ color: accent }}>→ request now</span>
      </button>
      </>
    );
  }

  return (
    <div className="relative mt-2 space-y-1.5 rounded-lg border border-white/20 bg-black/30 p-2">
      <Honeypot {...honeypot} />
      <p className="text-[11px] font-semibold text-white">Request a size or quantity</p>
      {sizes.length > 1 && (
        <select value={target} onChange={(e) => setSizeId(Number(e.target.value))} aria-label="Size"
          className="w-full rounded-md border border-white/15 bg-black/50 px-1.5 py-1 text-xs text-white outline-none">
          {sizes.map((s) => <option key={s.id} value={s.id} disabled={requested.has(s.id)}>{s.label}{requested.has(s.id) ? " (requested)" : ""}</option>)}
        </select>
      )}
      <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))} placeholder="How many?" aria-label="Quantity"
        className="w-full rounded-md border border-white/15 bg-black/50 px-1.5 py-1 text-xs text-white outline-none placeholder:text-neutral-500" />
      <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Note (optional) — e.g. 1 lb bag" aria-label="Note"
        className="w-full rounded-md border border-white/15 bg-black/50 px-1.5 py-1 text-xs text-white outline-none placeholder:text-neutral-500" />
      {error && <p className="text-[10px] text-[#FF5C3A]">{error}</p>}
      <div className="flex gap-1.5">
        <button type="button" onClick={send} disabled={busy || !quantity}
          className="flex-1 rounded-md px-2 py-1 text-xs font-semibold text-black disabled:opacity-40" style={{ background: accent }}>
          {busy ? "Sending…" : "Send request"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-300">Cancel</button>
      </div>
      <p className="text-[10px] leading-snug text-neutral-500">One request per size. The shop gets it and replies if they can.</p>
    </div>
  );
}
