"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Info = { code: string; percent_off: number; promoter_name: string | null };

// Pops a NorthEDM welcome when a shopper arrives from a scanned hoodie
// (/h/<code> redirects here with ?welcome=<code>). Shows the code with a copy
// button; the discount is already armed via cookie, so it applies at checkout.
export function HoodieWelcome() {
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("welcome");
    if (!code) return;
    // Clean the URL so a refresh doesn't re-pop.
    params.delete("welcome");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));

    fetch(`/api/hoodie?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setInfo({ code: j.code, percent_off: j.percent_off, promoter_name: j.promoter_name }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setInfo(null); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [info]);

  if (!info) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(info!.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the code is visible to type manually */ }
  }

  const who = info.promoter_name ? info.promoter_name : "a NorthEDM promoter";

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-5"
      style={{ background: "rgba(3,3,4,0.82)", backdropFilter: "blur(6px)" }}
      onClick={() => setInfo(null)}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-neutral-950 p-8 text-center"
      >
        {/* spectral aura */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48"
          style={{ background: "radial-gradient(ellipse at center, rgba(57,255,20,0.18), transparent 70%)" }}
        />
        <button
          onClick={() => setInfo(null)}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white/5 hover:text-white"
        >
          ✕
        </button>

        <div className="relative">
          <p className="font-dm-mono text-[11px] uppercase tracking-[0.34em] text-[#39FF14]">
            🍄 Spore-tagged
          </p>
          <h2 className="mt-3 font-bebas text-5xl leading-none tracking-wide text-white">
            You&apos;re in the network
          </h2>
          <p className="mt-4 text-sm leading-6 text-neutral-300">
            A Promoter Hoodie just plugged you into NorthEDM. This code is yours —{" "}
            <span className="font-semibold text-[#39FF14]">{info.percent_off}% off</span> your order,
            and the same amount flows back to {who}. Unite the Northeast.
          </p>

          {/* Code + copy */}
          <div className="mt-6 flex items-stretch gap-2">
            <div className="flex flex-1 items-center justify-center rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/[0.06] px-4 py-3">
              <span className="font-dm-mono text-xl tracking-[0.22em] text-white">{info.code}</span>
            </div>
            <button
              onClick={copy}
              className="shrink-0 rounded-xl bg-[#00D4FF] px-4 py-3 font-dm-mono text-xs font-bold uppercase tracking-widest text-black transition hover:opacity-90"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 font-dm-mono text-[11px] text-neutral-500">
            Already applied at checkout — copy it to keep or share.
          </p>

          <Link
            href="/shop"
            onClick={() => setInfo(null)}
            className="mt-6 block w-full rounded-2xl bg-[#39FF14] px-6 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Shop the drop →
          </Link>
        </div>
      </div>
    </div>
  );
}
