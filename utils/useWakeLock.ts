"use client";
import { useEffect } from "react";

/**
 * Keep the phone's screen on while `active` (Screen Wake Lock API: Chrome on
 * Android, Safari 16.4+). Browsers stop sharing location when the screen
 * locks or the page goes to the background, so FestDash keeps it awake while
 * a runner is delivering or a customer is sharing their live location. The
 * lock drops whenever the page is hidden; it is taken again on return.
 * Does nothing where the API isn't supported.
 */
type Sentinel = { release: () => Promise<void> };
type WakeLockNav = Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const nav = navigator as WakeLockNav;
    if (!nav.wakeLock) return;
    let lock: Sentinel | null = null;
    let stopped = false;
    const take = () => {
      if (stopped || document.visibilityState !== "visible") return;
      nav.wakeLock!.request("screen").then((l) => { if (stopped) l.release(); else lock = l; }).catch(() => {});
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", take);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

/** Whether this browser can keep the screen on (for wording the hint). */
export function canKeepScreenOn() {
  return typeof navigator !== "undefined" && !!(navigator as WakeLockNav).wakeLock;
}
