"use client";
import { useEffect, useState } from "react";

// "N accounts have no username — email them a prompt." Lives on /admin/users.
// The route previews the list (GET) and sends + stamps (POST), so pressing it
// twice never emails anyone twice.
export function UsernameNudge() {
  const [info, setInfo] = useState<{ count: number; people: { display_name: string | null; email: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    let on = true;
    (async () => {
      const res = await fetch("/api/admin/username-nudge");
      const j = await res.json().catch(() => null);
      if (on && res.ok && j) setInfo(j);
    })();
    return () => { on = false; };
  }, []);

  if (!info) return null;
  if (info.count === 0) {
    return result ? <p className="mt-3 text-sm text-green-400">{result}</p> : null;
  }

  async function send() {
    if (!confirm(`Email ${info!.count} account${info!.count === 1 ? "" : "s"} a one-time "pick your username" note?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/username-nudge", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setResult(j.error ?? "Couldn't send."); return; }
    setResult(`Sent ${j.sent} of ${j.total}${j.failed?.length ? ` — ${j.failed.length} failed: ${j.failed.map((f: { email: string }) => f.email).join(", ")}` : ""}.`);
    setInfo({ count: 0, people: [] });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
      <p className="text-sm text-yellow-200">
        {info.count} account{info.count === 1 ? " has" : "s have"} no username yet
        <span className="text-neutral-500"> · {info.people.map((p) => p.display_name || p.email).slice(0, 6).join(", ")}{info.count > 6 ? ", …" : ""}</span>
      </p>
      <button onClick={send} disabled={busy} className="rounded-xl bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-yellow-400 disabled:opacity-50">
        {busy ? "Sending…" : "Email them a prompt"}
      </button>
      {result && <p className="w-full text-xs text-neutral-300">{result}</p>}
    </div>
  );
}
