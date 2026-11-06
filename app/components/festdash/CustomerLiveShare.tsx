"use client";
import { useEffect, useRef, useState } from "react";
import { useWakeLock } from "@/utils/useWakeLock";
import type { MapPoint } from "./LiveMap";

/**
 * "Share my live location with my runner" (owner, 2026-11-06). Off until the
 * customer turns it on; only the runner assigned to the order can read it
 * (/api/festdash/orders/[id]/customer-location), and it is wiped when the
 * order is delivered. Sends a position about every 12 seconds while this page
 * is open, keeps the screen on, and reports the position to the page so its
 * own map can show it.
 */
export function CustomerLiveShare({ orderId, onPosition }: { orderId: string; onPosition: (p: MapPoint | null) => void }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const report = useRef(onPosition);
  useEffect(() => { report.current = onPosition; }, [onPosition]);
  useWakeLock(on);

  // Resume if they were already sharing (e.g. the page was reloaded).
  useEffect(() => {
    fetch(`/api/festdash/orders/${orderId}/customer-location`).then((r) => r.json())
      .then((j) => { if (j.sharing) setOn(true); }).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    if (!on || typeof navigator === "undefined" || !navigator.geolocation) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        report.current(p);
        const now = Date.now();
        if (now - last < 12000) return;
        last = now;
        fetch(`/api/festdash/orders/${orderId}/customer-location`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
        }).then((r) => {
          if (r.ok) setSent(Date.now());
          else if (r.status === 409) { setOn(false); report.current(null); } // delivered / closed
        }).catch(() => {});
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED
          ? "Location is blocked for this site. Allow it in your browser settings, then try again."
          : "Couldn't get your location yet — move into the open and give it a moment.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [on, orderId]);

  function start() {
    setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) { setError("Location isn't available on this device."); return; }
    setOn(true);
  }
  async function stop() {
    setBusy(true);
    setOn(false);
    report.current(null);
    await fetch(`/api/festdash/orders/${orderId}/customer-location`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
  }

  return (
    <div className="mb-4 rounded-2xl border border-purple-400/25 bg-purple-500/[0.06] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{on ? "📍 Sharing your live location" : "Not at your campsite?"}</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            {on
              ? `Your runner can follow you to you. Keep this page open${sent ? ` · last sent ${new Date(sent).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}.`
              : "Share your live location so your runner can find you. Only your runner sees it, and it stops when your order is delivered."}
          </p>
        </div>
        <button type="button" onClick={on ? stop : start} disabled={busy}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${on ? "border border-white/15 text-neutral-200 hover:bg-white/5" : "bg-purple-400 text-black hover:opacity-90"}`}>
          {on ? "Stop sharing" : "Share live location"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[#FF6B6B]">{error}</p>}
    </div>
  );
}
