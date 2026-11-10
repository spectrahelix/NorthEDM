'use client';
import { useEffect, useState } from 'react';

type Order = { id: string; title: string; license: string; price_cents: number; fee_cents: number; status: string; created_at: string };
export function AudioPurchases({ selling = false }: { selling?: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [confirmRefund, setConfirmRefund] = useState('');
  async function load() {
    setError('');
    try {
      const r = await fetch('/api/artisan/audio/purchases?' + (selling ? 'selling=1' : 'selling=0'));
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setOrders(data.orders);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }
  useEffect(() => {
    let active = true;
    fetch('/api/artisan/audio/purchases?' + (selling ? 'selling=1' : 'selling=0')).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (active) setOrders(data.orders);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selling]);
  async function act(orderId: string, refund = false) {
    setBusy(orderId); setError('');
    try {
      const r = await fetch(refund ? '/api/artisan/audio/purchases' : '/api/artisan/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'download', orderId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (data.url) window.location.assign(data.url);
      else { setConfirmRefund(''); await load(); }
    } catch (e) { setError((e as Error).message); }
    setBusy('');
  }
  return <div className="mt-4 space-y-4">
    <button className="text-sm text-[#FFC93C] underline" onClick={load}>Refresh {selling ? 'sales' : 'purchases'}</button>
    {loading ? <p>Loading recordings…</p> : !orders.length && !error ? <p className="text-sm text-neutral-400">No {selling ? 'sales' : 'purchases'} yet.</p> : null}
    {error && <p role="alert" className="text-sm text-[#FF5C3A]">{error}</p>}
    {orders.map(order => <article key={order.id} className="rounded-xl border border-white/10 p-4">
      <h3 className="font-semibold">{order.title}</h3>
      <p className="mt-1 text-sm text-neutral-400">${(order.price_cents / 100).toFixed(2)} USD · {order.status.replaceAll('_', ' ')}</p>
      {selling && <p className="text-sm text-neutral-400">Creator share: ${((order.price_cents - order.fee_cents) / 100).toFixed(2)} before any adjustments · bank deposits follow Stripe’s schedule.</p>}
      <details className="mt-2 text-sm text-neutral-400"><summary>Purchased license and reference</summary><p className="mt-2 whitespace-pre-wrap">{order.license}</p><p className="mt-2 break-all">{order.id}</p></details>
      {!selling && order.status === 'paid' && <button disabled={busy === order.id} onClick={() => act(order.id)} className="mt-3 rounded-lg border border-[#FFC93C]/40 px-3 py-2 text-sm text-[#FFC93C]">{busy === order.id ? 'Preparing…' : 'Download recording'}</button>}
      {!selling && order.status === 'pending' && <p className="mt-2 text-sm text-neutral-400">If you paid, refresh shortly for confirmation.</p>}
      {selling && ['paid','refund_pending'].includes(order.status) && (confirmRefund === order.id ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span>Refund the full purchase and revoke further downloads?</span>
        <button disabled={busy === order.id} onClick={() => act(order.id, true)} className="text-[#FF5C3A] underline">Confirm refund</button>
        <button onClick={() => setConfirmRefund('')}>Cancel</button>
      </div> : <button onClick={() => setConfirmRefund(order.id)} className="mt-3 text-sm text-[#FFC93C] underline">{order.status === 'refund_pending' ? 'Check or retry refund' : 'Issue full refund'}</button>)}
    </article>)}
  </div>;
}
