"use client";

import { ACCENT_CHOICES } from "@/utils/accent";

/**
 * Swatch picker for a vendor's or store's accent. Choices come from
 * utils/accent.ts, every one checked readable as price text AND as a button
 * behind black text — so whatever is picked here can't break the page.
 */
export function AccentPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const current = value.toUpperCase();
  const known = ACCENT_CHOICES.some((c) => c.hex === current);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ACCENT_CHOICES.map((c) => {
          const on = c.hex === current;
          return (
            <button key={c.hex} type="button" onClick={() => onChange(c.hex)} title={c.name}
              aria-label={c.name} aria-pressed={on}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${on ? "border-white/60 bg-white/10 text-white" : "border-white/10 text-neutral-400 hover:bg-white/5"}`}>
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: c.hex }} />
              {c.name}
            </button>
          );
        })}
      </div>
      {/* Live sample: the two ways the accent is actually used. */}
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3">
        <span className="font-bebas text-2xl" style={{ color: value }}>$24.00</span>
        <span className="rounded-lg px-3 py-1 text-xs font-semibold text-black" style={{ background: value }}>Add</span>
        {!known && <span className="font-dm-mono text-[10px] text-neutral-500">custom colour set by NorthEDM</span>}
      </div>
    </div>
  );
}
