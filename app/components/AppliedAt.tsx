"use client";

import { useEffect, useState } from "react";

/**
 * When an application came in, and — while it is still waiting on a decision —
 * how long it has been waiting, in days, hours and minutes.
 *
 * One component for every admin queue (vendors, FestDash vendors, FestDash
 * promoters, marketplace, artisans) so they all read the same way and a fix
 * lands everywhere at once. Before this, two pages had their own copy of a
 * "time ago" helper and the rest showed a bare date or nothing.
 *
 * Rendered only after mount: the date is shown in the viewer's own timezone,
 * which the server cannot know, so rendering it on the server would print one
 * time and then flicker to another.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function waitingFor(ms: number): string {
  if (ms < MINUTE) return "under a minute";
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  // Leading zero units are dropped ("3h 12m", not "0d 3h 12m"); once a larger
  // unit is shown, the smaller ones always are, so widths stay comparable.
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AppliedAt({
  at,
  waiting,
}: {
  /** ISO timestamp the application was submitted. */
  at: string | null | undefined;
  /** True while it still needs a decision. Decided ones show the date only. */
  waiting: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // First paint on the next tick rather than synchronously inside the
    // effect, which React's lint rule rejects as a cascading render.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const tick = waiting ? setInterval(() => setNow(Date.now()), MINUTE) : undefined;
    return () => {
      clearTimeout(first);
      if (tick) clearInterval(tick);
    };
  }, [waiting]);

  if (!at) {
    return <p className="text-xs text-neutral-600">Applied date not recorded</p>;
  }
  if (now === null) {
    // Same height as the real line, so the card doesn't jump when it appears.
    return <p className="text-xs text-transparent">.</p>;
  }

  const applied = new Date(at);
  const stamp = applied.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: applied.getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (!waiting) {
    return <p className="text-xs text-neutral-500">Applied {stamp}</p>;
  }

  const ms = Math.max(0, now - applied.getTime());
  // A queue reads at a glance: fresh is quiet, a day is a nudge, three is late.
  const tone =
    ms >= 3 * DAY ? "text-[#FF5C3A]" : ms >= DAY ? "text-[#FFC93C]" : "text-neutral-400";

  return (
    <p className="text-xs text-neutral-500">
      Applied {stamp} ·{" "}
      <span className={`font-medium ${tone}`}>waiting {waitingFor(ms)}</span>
    </p>
  );
}
