"use client";
import { useState } from "react";

// One-tap share: opens the native share sheet (Messages, Instagram, Discord…)
// on phones, falls back to copying the link on desktop. Use it anywhere you want
// people to spread a page — pass a url/title, or let it default to this page.
export function ShareButton({
  url,
  title = "NorthEDM — Unite the Northeast",
  text = "Check out NorthEDM — festival culture, EDM, foraging, a vendor marketplace, and FestDash delivery.",
  label = "Share",
  className = "",
  compact = false,
}: {
  url?: string;
  title?: string;
  text?: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "https://northedm.com");
    // Native share sheet where available (mobile). navigator.share must be
    // called from a user gesture — this click handler qualifies.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — nothing more we can do silently */
    }
  }

  return (
    <button
      onClick={onShare}
      aria-label={label}
      className={
        className ||
        "inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 transition hover:border-[#00D4FF]/40 hover:text-white"
      }
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {!compact && <span>{copied ? "Copied link ✓" : label}</span>}
    </button>
  );
}
