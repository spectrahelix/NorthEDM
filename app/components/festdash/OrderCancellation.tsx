"use client";
import { useState } from "react";

/** Inline confirmation works in the Android webview, where window.confirm and
 * window.prompt may be unavailable. The API still checks the actor and state. */
export function OrderCancellation({ orderId, label, onChange }: { orderId: string; label: string; onChange?: () => void }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function cancel() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/festdash/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "declined" }) });
      const data = await res.json();
      if (!res.ok) setMessage(data.error || "The order changed. Refresh before trying again.");
      else { setArmed(false); setMessage(data.payment_pending ? "Order closed. Payment cancellation or refund is pending provider confirmation." : "Order closed. Check its payment status for the confirmed cancellation or refund."); onChange?.(); }
    } catch { setMessage("Couldn't confirm the result. Check the order before retrying."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 w-full text-sm">
    {!armed ? <button type="button" onClick={() => setArmed(true)} className="text-red-300 underline underline-offset-4">{label}</button> : <div className="rounded-xl border border-red-400/25 bg-red-950/10 p-4">
      <p className="leading-6 text-neutral-300">This closes the unfulfilled order and cancels its card hold, or requests a refund if already charged. The provider must confirm the result.</p>
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={cancel} disabled={busy} className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Closing…" : "Confirm order cancellation"}</button><button type="button" onClick={() => setArmed(false)} disabled={busy} className="rounded-xl border border-white/20 px-4 py-2 text-neutral-300">Keep order</button></div>
    </div>}
    {message && <p role="status" className="mt-3 text-orange-300">{message}</p>}
  </div>;
}
