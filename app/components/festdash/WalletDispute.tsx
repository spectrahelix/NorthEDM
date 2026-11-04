"use client";
import { useState } from "react";

/**
 * "I paid but it wasn't confirmed" — shown to the customer on a wallet order
 * 24h after they gave their reference, or when the payment was rejected.
 * Goes straight to NorthEDM (/api/wallet-dispute), not through the coordinator.
 */
export function WalletDispute({ kind, id, refAt, rejected, alreadyReported }: { kind: "festdash" | "store"; id: string; refAt: string | null; rejected?: boolean; alreadyReported?: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(!!alreadyReported);
  const [err, setErr] = useState("");
  // eslint-disable-next-line react-hooks/purity
  const waited = refAt ? Date.now() - new Date(refAt).getTime() > 24 * 3600e3 : false;
  if (!rejected && !waited && !done) return null;
  if (done) return <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">NorthEDM has your report and will check this payment with the shop&apos;s coordinator. Keep your wallet&apos;s transaction receipt.</p>;
  async function send() {
    setBusy(true); setErr("");
    const r = await fetch("/api/wallet-dispute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, note }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setDone(true); else setErr(j.error ?? "Couldn't send that.");
  }
  return (
    <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm">
      <p className="text-yellow-200">{rejected ? "Your payment was marked as not received." : "Your payment hasn't been confirmed after 24 hours."}</p>
      <p className="mt-1 text-neutral-400">If you sent it, tell NorthEDM directly — we check it with the coordinator.</p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-xl border border-yellow-400/40 px-4 py-2 text-yellow-100 hover:bg-yellow-500/10">I paid but it wasn&apos;t confirmed</button>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: when you sent it, from which number" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none" />
          <button onClick={send} disabled={busy} className="rounded-xl bg-yellow-500 px-4 py-2 font-semibold text-black disabled:opacity-50">{busy ? "Sending…" : "Send to NorthEDM"}</button>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      )}
    </div>
  );
}
