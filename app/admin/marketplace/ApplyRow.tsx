"use client";

import { useState } from "react";
import Link from "next/link";

export function ApplyActions({ appId, userId }: { appId: string; userId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function act(action: "approve" | "reject") {
    setBusy(true); setErr("");
    const res = await fetch("/api/admin/marketplace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId, action }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || "Failed"); return; }
    setDone(action === "approve" ? "Granted ✓" : "Rejected");
  }

  if (done) return <span className="font-dm-mono text-xs text-neutral-500">{done} — reload to refresh</span>;

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-[#FF5C3A]">{err}</span>}
      <Link href={`/profile/${userId}`} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5">View</Link>
      <button onClick={() => act("approve")} disabled={busy}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50" style={{ background: "#00D4FF" }}>
        {busy ? "…" : "Grant access"}
      </button>
      <button onClick={() => act("reject")} disabled={busy}
        className="rounded-lg border border-[#FF5C3A]/30 px-3 py-1.5 text-xs text-[#FF5C3A] transition hover:bg-[#FF5C3A]/10 disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}
