"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Handoff = {
  ok: boolean; party: "customer" | "fulfiller"; own_code: string | null;
  customer_confirmed: boolean; fulfiller_confirmed: boolean; ready: boolean;
  problem_reported: boolean; locked: boolean; order_status: string; payment_status: string; legacy?: boolean;
};

/** This endpoint returns only the signed-in person's own private code. Codes
 * never come from order rows, phone numbers, or the realtime payload. */
export function HandoffConfirmation({ orderId, pickup = false, onChange }: { orderId: string; pickup?: boolean; onChange?: () => void }) {
  const [state, setState] = useState<Handoff | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = `/api/festdash/orders/${orderId}/handoff`;
  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) { setState(data); setError(""); }
      else setError(data.error || "Secure handoff is unavailable. Contact NorthEDM.");
    } catch { setError("Couldn't check the handoff. Payment remains pending; try again."); }
  }, [endpoint]);
  useEffect(() => { load(); const timer = setInterval(load, 10_000); return () => clearInterval(timer); }, [load]);

  async function submit(action: "confirm" | "problem") {
    if (action === "confirm" && !state?.ready && !/^\d{4}$/.test(code)) { setError("Enter the other person's four-digit code."); return; }
    let reason: string | null = null;
    if (action === "problem") {
      reason = window.prompt("What went wrong? This pauses payment release so NorthEDM can help.");
      if (reason === null) return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, code, reason }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Confirmation failed.");
      else {
        setState(data); setCode("");
        setMessage(data.ready ? "Both confirmations received. Check payment status below." : action === "problem" ? "Payment release is paused. Contact NorthEDM for help." : "Your confirmation is saved. Waiting for the other person.");
        onChange?.();
      }
    } catch { setError("Couldn't save the confirmation. Check the status before trying again."); }
    finally { setBusy(false); }
  }

  async function cancelUnaccepted() {
    if (!window.confirm("Cancel this unaccepted order and release its card hold?")) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/festdash/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "declined" }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "The order changed. Refresh before canceling.");
      else { onChange?.(); await load(); }
    } catch { setError("Couldn't confirm cancellation. Check the order status before retrying."); }
    finally { setBusy(false); }
  }

  const customer = state?.party === "customer";
  const mineConfirmed = customer ? state?.customer_confirmed : state?.fulfiller_confirmed;
  const other = customer ? (pickup ? "shop operator" : "Dasher") : "customer";
  const closed = state?.order_status === "declined";
  const canConfirm = !!state && ["accepted", "in_transit"].includes(state.order_status) && !mineConfirmed && !state.locked && !state.problem_reported;
  if (state?.legacy) return <p className="my-4 text-sm text-neutral-400">This order was completed before two-way handoff confirmation was introduced. Payment status: {state.payment_status}. Contact NorthEDM with any concern.</p>;
  return (
    <section aria-label="Secure handoff" className="my-4 rounded-2xl border border-green-500/25 bg-green-950/10 p-5 text-sm text-neutral-300">
      <h3 className="font-bebas text-2xl tracking-wide text-white">Confirm handoff together</h3>
      <p className="mt-2 leading-6">Payment is released after both people confirm from their own accounts. At handover, enter each other&apos;s random code. Share your code only when you receive or hand over the order.</p>
      {state?.own_code && !closed && <div className="mt-4 rounded-xl bg-black/30 p-4 text-center"><p className="text-xs text-neutral-400">Your private handoff code</p><p className="mt-1 font-dm-mono text-3xl tracking-[0.35em] text-white">{state.own_code}</p><p className="mt-2 text-xs text-neutral-400">Show this to the {other} at handover. It is independent of your phone number.</p></div>}
      {state && <p className="mt-3">Customer: {state.customer_confirmed ? "confirmed ✓" : "waiting"} · {pickup ? "Shop" : "Dasher"}: {state.fulfiller_confirmed ? "confirmed ✓" : "waiting"}</p>}
      {state?.problem_reported && <p className="mt-3 text-orange-300">Handoff problem reported. Payment release is paused; contact NorthEDM.</p>}
      {state?.locked && <p className="mt-3 text-orange-300">Too many incorrect codes. Contact NorthEDM; payment is not unlocked by guessing.</p>}
      {canConfirm && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input aria-label={`Code from the ${other}`} inputMode="numeric" autoComplete="off" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={`${pickup && customer ? "Shop" : customer ? "Dasher" : "Customer"} code`} className="min-w-0 rounded-xl border border-white/15 bg-black/30 px-3 py-3 font-dm-mono text-lg tracking-widest text-white" /><button type="button" disabled={busy || code.length !== 4} onClick={() => submit("confirm")} className="rounded-xl bg-green-500 px-4 py-3 font-semibold text-black disabled:opacity-40">{busy ? "Saving…" : customer ? "I received my order — confirm" : "I handed over the order — confirm"}</button></div>}
      {state?.ready && <p className="mt-3 text-green-300">Both confirmations are saved. {state.payment_status === "released" ? "Payment captured; payouts follow the provider's processing schedule." : "Payment settlement is pending. It will retry if processing fails; contact support if it remains pending."}</p>}
      {state?.ready && state.payment_status !== "released" && <button type="button" onClick={() => submit("confirm")} disabled={busy} className="mt-3 rounded-xl border border-white/20 px-4 py-2 disabled:opacity-40">{busy ? "Checking…" : "Check payment settlement"}</button>}
      {!closed && state && !state.ready && ["pending", "accepted", "in_transit"].includes(state.order_status) && <button type="button" onClick={() => submit("problem")} disabled={busy || state.problem_reported} className="mt-4 block text-orange-300 underline underline-offset-4 disabled:opacity-40">Report a handoff problem / pause release</button>}
      {customer && state?.order_status === "pending" && <button type="button" onClick={cancelUnaccepted} disabled={busy} className="mt-4 block text-red-300 underline underline-offset-4 disabled:opacity-40">Cancel this unaccepted order</button>}
      {message && <p role="status" className="mt-3 text-green-300">{message}</p>}
      {error && <p role="alert" className="mt-3 text-orange-300">{error}</p>}
      <p className="mt-4 text-xs leading-6 text-neutral-400">A failed order releases an uncaptured card hold; an already captured payment needs a refund to its original payment method. Provider and bank times vary. <Link href="/terms#festdash" className="text-orange-300 underline underline-offset-4">Customer terms</Link> · <Link href="/festdash/driver/terms" className="text-orange-300 underline underline-offset-4">Dasher terms</Link> · <a href="mailto:northedm1@gmail.com" className="text-orange-300 underline underline-offset-4">Contact NorthEDM</a></p>
    </section>
  );
}
