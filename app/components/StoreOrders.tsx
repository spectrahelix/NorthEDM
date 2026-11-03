"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/utils/money";

type O = { id: string; status: string; items: { name: string; qty: number; price_cents: number }[]; total_cents: number; currency: string | null; payment_method: string | null; email: string | null; ship_name: string | null; ship_address: { line1?: string; city?: string; country?: string } | null; authorized_at: string | null; fulfilled_at: string | null; created_at: string; shipping_cents?: number | null; shipping_service?: string | null; tracking_number?: string | null };

/** The operator's orders: hand over (captures a held card) or cancel (releases it). */
export function StoreOrders({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<O[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => fetch(`/api/store/${slug}/orders`).then((r) => (r.ok ? r.json() : { orders: [] })).then((j) => setOrders(j.orders ?? [])).catch(() => setOrders([]));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);
  async function act(id: string, action: "handed_over" | "cancel") {
    if (action === "cancel" && !confirm("Cancel this order? A held card is released and the stock goes back.")) return;
    setBusy(id); setMsg("");
    const r = await fetch(`/api/store/orders/${id}/fulfill`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg(r.ok ? (j.captured ? "Handed over — the card has been charged." : action === "cancel" ? "Cancelled." : "Marked handed over.") : j.error ?? "Failed.");
    load();
  }
  if (!orders) return null;
  const open = orders.filter((o) => !o.fulfilled_at && o.status !== "canceled");
  const label = (o: O) => o.status === "authorized" ? "Card held — charge at handover" : o.status === "awaiting_confirmation" ? "Waiting for wallet payment" : o.fulfilled_at ? "Done" : "Paid — hand over";
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Orders</p>
      <p className="mt-1 text-sm text-neutral-400">Press <span className="text-white">Handed over</span> when the customer has their items. On a card order that is the moment the card is charged; until then it is only held.</p>
      {msg && <p className="mt-2 text-sm text-neutral-300">{msg}</p>}
      <div className="mt-3 space-y-2">
        {open.length === 0 ? <p className="text-sm text-neutral-500">No open orders.</p> : open.map((o) => (
          <div key={o.id} className={`rounded-xl border px-4 py-3 ${o.status === "authorized" ? "border-orange-500/30 bg-orange-950/20" : "border-white/10 bg-white/[0.02]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-white">{(o.items ?? []).map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                <p className="text-xs text-neutral-500">{formatMoney(o.total_cents, o.currency ?? "USD")} · {label(o)} · {new Date(o.created_at).toLocaleString()}{o.ship_name ? ` · ${o.ship_name}` : ""}{o.email ? ` · ${o.email}` : ""}</p>
                {o.ship_address?.line1 && <p className="text-xs text-neutral-500">{[o.ship_address.line1, o.ship_address.city, o.ship_address.country].filter(Boolean).join(", ")}{o.shipping_service ? ` · ${o.shipping_service} (${formatMoney(o.shipping_cents ?? 0, o.currency ?? "USD")} paid)` : ""}</p>}
                {o.status !== "awaiting_confirmation" && (
                  <p className="mt-1 flex gap-3 text-xs">
                    <a href={`/orders/store/${o.id}/label`} target="_blank" rel="noreferrer" className="text-[#3AFFD4] underline-offset-2 hover:underline">Shipping label</a>
                    <a href={`/orders/store/${o.id}/invoice`} target="_blank" rel="noreferrer" className="text-[#3AFFD4] underline-offset-2 hover:underline">Invoice</a>
                    <a href={`/orders/store/${o.id}/receipt`} target="_blank" rel="noreferrer" className="text-[#3AFFD4] underline-offset-2 hover:underline">Receipt</a>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {o.status !== "awaiting_confirmation" && (
                  <button onClick={() => act(o.id, "handed_over")} disabled={busy === o.id} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy === o.id ? "…" : "Handed over"}</button>
                )}
                {o.status !== "paid" && (
                  <button onClick={() => act(o.id, "cancel")} disabled={busy === o.id} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 disabled:opacity-50">Cancel</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
