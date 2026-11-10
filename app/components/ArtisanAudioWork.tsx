'use client';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import type { ArtisanWork } from '@/utils/supabase/user-profiles';

type Offer = { available: boolean; seller: string; owner: boolean; offer: { price_cents: number; license: string } | null; purchase: { id: string; status: string } | null };
const subscribePlatform = () => () => {};
const nativePlatform = () => Capacitor.isNativePlatform();
const serverPlatform = () => true;
export function ArtisanAudioWork({ work }: { work: ArtisanWork }) {
  const [data, setData] = useState<Offer | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const native = useSyncExternalStore(subscribePlatform, nativePlatform, serverPlatform);
  useEffect(() => {
    fetch(`/api/artisan/audio?work=${work.id}`).then(r => r.ok ? r.json() : null).then(setData).catch(() => {});
  }, [work.id]);
  async function purchase() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/artisan/audio', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', workId: work.id, acceptedPrice: data?.offer?.price_cents,
          acceptedLicense: accepted ? data?.offer?.license : null, acceptedTerms: accepted ? '2026-11-10' : null, immediateDelivery: delivery }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      window.location.assign(result.url);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <div className="p-4">
    <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-[#FFC93C]">Audio portfolio</p>
    <audio controls preload="none" src={work.url || undefined} aria-label={work.title || 'Audio sample'} className="w-full" />
    {data?.purchase?.status === 'paid' ? <Link href="/audio/purchases" className="mt-4 inline-block text-sm text-[#FFC93C] underline">View your recording and download</Link> : data?.available && data.offer && !data.owner && !native ? <div className="mt-4 border-t border-white/10 pt-4">
      <p className="text-sm text-neutral-300">Licensed recording · ${(data.offer.price_cents / 100).toFixed(2)} USD</p>
      <p className="mt-1 text-xs text-neutral-400">Seller: {data.seller}. The public player is a preview; purchase includes the separate original file.</p>
      <details className="mt-2 text-sm text-neutral-400"><summary>Read the license</summary><p className="mt-2 whitespace-pre-wrap">{data.offer.license}</p></details>
      <label className="mt-3 flex items-start gap-2 text-xs text-neutral-400"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
        <span>I agree to this recording’s license and the <Link href="/audio/terms" className="underline">audio purchase terms</Link>.</span>
      </label>
      <label className="mt-3 flex items-start gap-2 text-xs text-neutral-400"><input type="checkbox" checked={delivery} onChange={e => setDelivery(e.target.checked)} /><span>I request digital delivery after payment confirmation. My statutory consumer rights remain.</span></label>
      <button onClick={purchase} disabled={busy || !accepted || !delivery} className="mt-3 rounded-lg bg-[#FFC93C] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">{busy ? 'Opening checkout…' : 'Buy recording'}</button>
      <Link href={`/login?next=/profile/${work.user_id}`} className="ml-3 text-xs text-neutral-400 underline">Sign in</Link>
    </div> : null}
    {error && <p role="alert" className="mt-2 text-sm text-[#FF5C3A]">{error}</p>}
  </div>;
}
