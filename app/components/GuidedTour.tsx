"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type TourStep = { target: string; title: string; body: string };

/**
 * Coach-mark walkthrough: dims the page, spotlights one element at a time
 * (found by its `data-tour` attribute) and explains it in a card with
 * Back / Next. Shown automatically once per device (`autoStart`) and
 * replayable from a "Show me how" button via `onOpen`.
 */
export function GuidedTour(props: { id: string; steps: TourStep[]; open: boolean; onClose: () => void; accent?: string }) {
  // Remounting on each open resets the step to the first one without an effect.
  const [opens, setOpens] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (props.open !== wasOpen) { setWasOpen(props.open); if (props.open) setOpens((n) => n + 1); }
  return props.open ? <TourBody key={opens} {...props} /> : null;
}

function TourBody({ id, steps, open, onClose, accent = "#00D4FF" }: { id: string; steps: TourStep[]; open: boolean; onClose: () => void; accent?: string }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  const measure = useCallback(() => {
    if (!open || !step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) { setRect(null); return; }
    setRect(el.getBoundingClientRect());
  }, [open, step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = window.setTimeout(measure, 350);
    const onMove = () => measure();
    window.addEventListener("resize", onMove); window.addEventListener("scroll", onMove, true);
    return () => { window.clearTimeout(t); window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function finish() {
    try { localStorage.setItem(`ne_tour_${id}`, "done"); } catch {}
    onClose();
  }
  if (!open || !step) return null;
  const pad = 8;
  const last = i === steps.length - 1;
  // Card goes under the target when there is room, otherwise above; on phones it sits at the bottom.
  const below = rect ? rect.bottom + pad + 180 < window.innerHeight : true;
  const cardStyle: React.CSSProperties = rect && window.innerWidth >= 640
    ? { position: "fixed", left: Math.max(12, Math.min(rect.left, window.innerWidth - 352)), ...(below ? { top: rect.bottom + pad + 6 } : { bottom: window.innerHeight - rect.top + pad + 6 }), width: 340 }
    : { position: "fixed", left: 12, right: 12, bottom: 12 };
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-label={step.title}>
      {/* Spotlight: a transparent box with a huge shadow dims everything but the target. */}
      {rect ? (
        <div className="pointer-events-none fixed rounded-xl transition-all duration-300" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)", border: `2px solid ${accent}` }} />
      ) : (
        <div className="fixed inset-0 bg-black/70" />
      )}
      <div style={cardStyle} className="rounded-2xl border border-white/15 bg-neutral-950 p-4 text-neutral-100 shadow-2xl">
        <p className="font-dm-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>Step {i + 1} of {steps.length}</p>
        <p className="mt-1 text-base font-semibold">{step.title}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-300">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="text-xs text-neutral-500 hover:text-neutral-300">Skip tour</button>
          <div className="flex gap-2">
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-neutral-200">Back</button>}
            <button type="button" onClick={() => (last ? finish() : setI(i + 1))} className="rounded-lg px-4 py-1.5 text-sm font-semibold text-black" style={{ background: accent }}>{last ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** True once per device until the tour has been finished or skipped. */
export function tourPending(id: string): boolean {
  try { return localStorage.getItem(`ne_tour_${id}`) !== "done"; } catch { return false; }
}
