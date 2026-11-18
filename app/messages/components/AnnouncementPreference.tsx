"use client";
import { useEffect, useState } from "react";
export function AnnouncementPreference() {
  const [optedOut, setOptedOut] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/messages/announcement-preference").then(r => r.json()).then(d => {
      if (typeof d.opted_out === "boolean") setOptedOut(d.opted_out);
    }).catch(() => setError("Preference unavailable.")).finally(() => setBusy(false));
  }, []);
  async function toggle() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/messages/announcement-preference", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ opted_out: !optedOut }) });
      if (!r.ok) throw new Error("Couldn't update the preference.");
      setOptedOut(!optedOut);
    } catch(e) { setError(e instanceof Error ? e.message : "Couldn't update preference."); }
    finally { setBusy(false); }
  }
  return <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
    <div className="flex items-center justify-between gap-3">
      <div><p className="font-semibold text-neutral-300">Community announcements</p><p className="mt-1 text-xs text-neutral-500">Control admin announcement DMs. One-time new-account welcome messages are separate.</p></div>
      <button type="button" disabled={busy} onClick={() => void toggle()} className="shrink-0 rounded-lg border border-white/20 px-3 py-2 text-xs text-neutral-200 disabled:opacity-50">{busy ? "Loading…" : optedOut ? "Turn on" : "Turn off"}</button>
    </div>
    {!busy && <p className="mt-2 text-xs text-neutral-500">Announcements: {optedOut ? "off" : "on"}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
  </div>;
}
