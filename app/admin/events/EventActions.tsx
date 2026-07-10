"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/local-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

export function EventActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: string) {
    setBusy(true);
    await post({ action, id });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {status !== "approved" && (
        <button
          onClick={() => run("approve")}
          disabled={busy}
          className="rounded-lg bg-[#39FF14]/15 px-3 py-1.5 font-dm-mono text-xs text-[#39FF14] transition hover:bg-[#39FF14]/25 disabled:opacity-50"
        >
          Approve
        </button>
      )}
      {status !== "hidden" && (
        <button
          onClick={() => run("hide")}
          disabled={busy}
          className="rounded-lg bg-white/5 px-3 py-1.5 font-dm-mono text-xs text-neutral-400 transition hover:bg-white/10 disabled:opacity-50"
        >
          Hide
        </button>
      )}
      <button
        onClick={() => {
          if (confirm("Delete this event permanently?")) run("delete");
        }}
        disabled={busy}
        className="rounded-lg bg-[#FF5C3A]/10 px-3 py-1.5 font-dm-mono text-xs text-[#FF5C3A] transition hover:bg-[#FF5C3A]/20 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    setBusy(true);
    setMsg("");
    const r = await post({ action: "refresh" });
    setBusy(false);
    if (r?.ok) {
      const src = r.discoverySource ? ` · discovery: ${r.discoverySource}` : " · discovery: off (no key)";
      setMsg(`Seeded ${r.seeded}, updated ${r.updated}, new discovered ${r.discovered}${src}`);
      router.refresh();
    } else {
      setMsg(r?.error || "Refresh failed.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={refresh}
        disabled={busy}
        className="rounded-xl bg-[#00D4FF]/15 px-4 py-2 font-dm-mono text-xs uppercase tracking-widest text-[#00D4FF] transition hover:bg-[#00D4FF]/25 disabled:opacity-50"
      >
        {busy ? "Refreshing…" : "↻ Refresh now"}
      </button>
      {msg && <span className="font-dm-mono text-xs text-neutral-400">{msg}</span>}
    </div>
  );
}
