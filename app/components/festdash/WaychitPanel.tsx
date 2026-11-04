"use client";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/utils/money";

// Owner's Waychit panel on /admin/festdash/coordinators: the on/off switch,
// the processing fee passed to customers, and the payouts queue (shop,
// coordinator and runner shares of Waychit-paid orders, sent from NorthEDM's
// own Waychit account). utils/waychit.ts, utils/waychitOrders.ts.
type Payout = {
  id: string; order_kind: string; order_id: string; role: string; vendor_name: string | null;
  channel: string | null; destination: string | null; amount_gmd: number; status: string; error: string | null; fee_gmd: number | null; created_at: string;
};
type State = { enabled: boolean; keys: boolean; fee_bps: number };
const CHANNELS = ["wave", "qmoney", "afrimoney", "bank"];

export function WaychitPanel() {
  const [state, setState] = useState<State | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [fee, setFee] = useState("3");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => fetch("/api/waychit/admin").then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j) return;
    setState(j.state); setPayouts(j.payouts ?? []); setFee(String((j.state?.fee_bps ?? 300) / 100));
  }).catch(() => {}), []);
  useEffect(() => { void fetch("/api/waychit/admin").then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j) return;
    setState(j.state); setPayouts(j.payouts ?? []); setFee(String((j.state?.fee_bps ?? 300) / 100));
  }).catch(() => {}); }, []);

  async function post(key: string, body: Record<string, unknown>, ok: string) {
    setBusy(key); setMsg("");
    const r = await fetch("/api/waychit/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? ok : j.error || "Something went wrong.");
    setBusy(null);
    await load();
  }

  if (!state) return null;
  const owed = payouts.filter((p) => p.status === "owed" || p.status === "failed");
  const owedTotal = owed.reduce((s, p) => s + p.amount_gmd, 0);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Waychit — Wave / QMoney / Afrimoney into your own account</p>
      <p className="text-sm text-neutral-300">
        Status: {state.enabled ? <span className="font-semibold text-emerald-400">ON — customers see it at checkout</span>
          : state.keys ? <span className="font-semibold text-yellow-300">OFF (keys are in place)</span>
          : <span className="font-semibold text-neutral-400">OFF — no keys yet</span>}
      </p>
      {!state.keys && (
        <p className="mt-2 text-xs text-neutral-500">
          To switch it on: once Waychit approves your merchant account, create an API key (with the <span className="font-dm-mono">payouts</span> scope) and a webhook signing secret in the Waychit merchant dashboard, add them in Vercel as <span className="font-dm-mono">WAYCHIT_API_KEY</span> and <span className="font-dm-mono">WAYCHIT_WEBHOOK_SECRET</span>, redeploy, and point the webhook at <span className="font-dm-mono">https://www.northedm.com/api/waychit/webhook</span>. There is no test mode — try it first with one small real order.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-neutral-500">Processing fee customers pay (%)
          <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className="mt-1 block w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
        </label>
        <button disabled={busy === "fee"} onClick={() => post("fee", { action: "settings", fee_bps: Math.round(Number(fee) * 100) }, "Fee saved.")} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50">Save fee</button>
        <button disabled={busy === "switch" || (!state.keys && !state.enabled)} onClick={() => post("switch", { action: "settings", enabled: !state.enabled }, state.enabled ? "Switched off." : "Switched on.")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${state.enabled ? "border border-red-400/40 text-red-300 hover:bg-red-500/10" : "bg-orange-500 text-black hover:bg-orange-400"}`}>
          {state.enabled ? "Switch off" : "Switch on"}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-neutral-300">{msg}</p>}

      <p className="mt-5 mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Payouts to send ({owed.length}{owed.length ? ` · D${owedTotal.toLocaleString()}` : ""})</p>
      {payouts.length === 0 ? <p className="text-sm text-neutral-500">Nothing yet. Each Waychit-paid order adds the shop&apos;s and coordinator&apos;s shares here (and the runner&apos;s at delivery).</p> : (
        <div className="space-y-2">
          {payouts.slice(0, 50).map((p) => (
            <PayoutRow key={p.id} p={p} busy={busy === p.id} canSend={state.enabled}
              onSave={(channel, destination) => post(p.id, { action: "set_destination", id: p.id, channel, destination }, "Saved.")}
              onSend={() => { if (confirm(`Send D${p.amount_gmd} to ${p.destination} by ${p.channel}? This moves real money.`)) post(p.id, { action: "send", id: p.id }, "Sent to Waychit."); }} />
          ))}
        </div>
      )}
    </section>
  );
}

function PayoutRow({ p, busy, canSend, onSave, onSend }: { p: Payout; busy: boolean; canSend: boolean; onSave: (c: string, d: string) => void; onSend: () => void }) {
  const [channel, setChannel] = useState(p.channel ?? "wave");
  const [dest, setDest] = useState(p.destination ?? "");
  const editable = p.status === "owed" || p.status === "failed";
  const color = p.status === "succeeded" ? "text-emerald-400" : p.status === "failed" || p.status === "reversed" ? "text-red-300" : p.status === "owed" ? "text-yellow-300" : "text-neutral-300";
  return (
    <div className="rounded-xl border border-white/10 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p><span className="font-semibold text-white">{formatMoney(p.amount_gmd * 100, "GMD")}</span> to the {p.role}{p.vendor_name ? ` · ${p.vendor_name}` : ""} <span className="text-neutral-500">· {p.order_kind} order {p.order_id.slice(0, 8)}</span></p>
        <span className={`font-dm-mono text-xs uppercase ${color}`}>{p.status}{p.fee_gmd ? ` · fee D${p.fee_gmd}` : ""}</span>
      </div>
      {p.error && <p className="mt-1 text-xs text-red-300">{p.error}</p>}
      {editable ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white">
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder={channel === "bank" ? "Account number" : "Wallet number (+220…)"} className="w-44 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white" />
          {(channel !== p.channel || dest !== (p.destination ?? "")) && <button disabled={busy} onClick={() => onSave(channel, dest)} className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/5">Save</button>}
          <button disabled={busy || !canSend || !p.channel || !p.destination || channel !== p.channel || dest !== p.destination} onClick={onSend}
            className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-40">{busy ? "Sending…" : p.status === "failed" ? "Retry" : "Send"}</button>
        </div>
      ) : p.destination ? <p className="mt-1 text-xs text-neutral-500">{p.channel} {p.destination}</p> : null}
    </div>
  );
}
