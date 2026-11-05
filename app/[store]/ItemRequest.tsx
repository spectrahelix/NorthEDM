"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Honeypot, useFormShield } from "@/app/components/FormShield";
import { JoinUsOnline } from "@/app/components/JoinUsOnline";

/**
 * "Couldn't find what you were looking for? → request here. I may be able to
 * get it!" (owner, 2026-11-05). One button at the top and one at the bottom of
 * a store — not a box on every card. Opens a small pop-up: pick one of the
 * shop's items or type anything, how many, an optional note. Signed-in only;
 * one request per person per item (or per thing typed) — the server refuses a
 * repeat — plus the form shield. The shop's operator sees them in Edit shop.
 */
export type RequestableItem = { id: number; label: string };

export function ItemRequestButton({ slug, accent, items }: { slug: string; accent: string; items: RequestableItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="group mx-auto my-6 flex w-full max-w-xl items-center justify-center gap-3 rounded-2xl border px-5 py-3 text-left transition hover:-translate-y-0.5"
        style={{ borderColor: `${accent}55`, background: `linear-gradient(90deg, ${accent}14, transparent 70%)` }}>
        <span aria-hidden className="text-2xl">🔎</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">Couldn&apos;t find what you were looking for?</span>
          <span className="block text-sm" style={{ color: accent }}>
            <span className="inline-block transition group-hover:translate-x-0.5">→</span> request here. <span className="text-neutral-300">I may be able to get it!</span>
          </span>
        </span>
      </button>
      {open && <RequestDialog slug={slug} accent={accent} items={items} onClose={() => setOpen(false)} />}
    </>
  );
}

function RequestDialog({ slug, accent, items, onClose }: { slug: string; accent: string; items: RequestableItem[]; onClose: () => void }) {
  const router = useRouter();
  const { shield, honeypot } = useFormShield();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [asked, setAsked] = useState<Set<number>>(new Set());
  const [pick, setPick] = useState<string>(""); // product id, or "" = something else
  const [text, setText] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`/api/store/${slug}/requests`).then((r) => r.json()).then((j) => {
      setSignedIn(!!j.signedIn);
      setAsked(new Set(((j.mine ?? []) as number[]).map(Number)));
    }).catch(() => setSignedIn(false));
  }, [slug]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toLogin = () => router.push(`/login?next=${encodeURIComponent(`/${slug}`)}`);

  async function send() {
    const q = Math.floor(Number(quantity));
    if (!pick && text.trim().length < 2) { setError("Pick an item or tell us what you're after."); return; }
    if (!(q >= 1)) { setError("How many?"); return; }
    setBusy(true); setError("");
    const res = await fetch(`/api/store/${slug}/requests`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: pick ? Number(pick) : undefined, itemText: pick ? undefined : text.trim(), quantity: q, note, ...shield() }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.status === 401) { toLogin(); return; }
    if (res?.ok) { setSent(true); return; }
    setError((j as { error?: string }).error || "Couldn't send that — try again.");
  }

  const input = "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/40";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal aria-label="Request an item" onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950 p-5 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg px-2 text-neutral-500 hover:text-white">✕</button>
        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-3xl">🙌</p>
            <p className="font-semibold text-white">Request sent!</p>
            <p className="text-sm text-neutral-400">The shop has it and will reach out if they can get it for you.</p>
            <JoinUsOnline compact />
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2 text-sm font-semibold text-black" style={{ background: accent }}>Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <Honeypot {...honeypot} />
            <div>
              <p className="text-base font-semibold text-white">Couldn&apos;t find what you were looking for?</p>
              <p className="text-sm text-neutral-400">Tell us what you want and how much. I may be able to get it!</p>
            </div>
            {signedIn === false ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-neutral-300">
                Sign in to send a request, so the shop can get back to you.
                <button type="button" onClick={toLogin} className="mt-2 block rounded-xl px-4 py-2 text-sm font-semibold text-black" style={{ background: accent }}>Sign in →</button>
              </div>
            ) : (
              <>
                {items.length > 0 && (
                  <label className="block">
                    <span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Item</span>
                    <select value={pick} onChange={(e) => setPick(e.target.value)} className={input}>
                      <option value="">Something else (type it below)</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id} disabled={asked.has(i.id)}>{i.label}{asked.has(i.id) ? " — already requested" : ""}</option>
                      ))}
                    </select>
                  </label>
                )}
                {!pick && (
                  <label className="block">
                    <span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">What are you looking for?</span>
                    <input value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} placeholder="e.g. Lion's Mane, 1 lb bag" className={input} />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">How many?</span>
                  <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))} className={input} />
                </label>
                <label className="block">
                  <span className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Note (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Size, timing, anything else" className={input} />
                </label>
                {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}
                <button type="button" onClick={send} disabled={busy || signedIn === null}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50" style={{ background: accent }}>
                  {busy ? "Sending…" : "Send request"}
                </button>
                <p className="text-center text-[11px] text-neutral-500">One request per item. The shop sees your username only.</p>
              </>
            )}
            <JoinUsOnline compact />
          </div>
        )}
      </div>
    </div>
  );
}
