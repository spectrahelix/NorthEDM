'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { ArtisanWork } from '@/utils/supabase/user-profiles';
import { ACCEPT_AUDIO, audioFile } from '@/utils/artisanAudio';
import { AudioPurchases } from '@/app/components/AudioPurchases';

const input = 'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100';
export function AudioPortfolioUpload({ userId, onAdded }: { userId: string; onAdded: (work: ArtisanWork) => void }) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    setBusy(true); setError('');
    try {
      const { ext, type } = audioFile(file);
      const db = createClient();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await db.storage.from('artisan-audio-previews').upload(path, file, { contentType: type, upsert: false });
      if (upError) throw upError;
      const { data: pub } = db.storage.from('artisan-audio-previews').getPublicUrl(path);
      const { data, error: rowError } = await db.from('artisan_works').insert({ user_id: userId, kind: 'audio',
        title: title.trim() || file.name, caption: caption.trim() || null, url: pub.publicUrl,
      }).select('*').single();
      if (rowError) { await db.storage.from('artisan-audio-previews').remove([path]); throw rowError; }
      onAdded(data as ArtisanWork); setTitle(''); setCaption('');
    } catch (e) { setError((e as Error).message); }
    if (fileRef.current) fileRef.current.value = '';
    setBusy(false);
  }
  return <div className="space-y-3">
    <p className="text-sm text-neutral-400">Upload a voice demo, music sample, or other recording to your portfolio. This sample is publicly playable. Selling a separate original is optional.</p>
    <input className={input} value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="Audio sample title" aria-label="Audio sample title" />
    <textarea className={input} value={caption} maxLength={1500} onChange={e => setCaption(e.target.value)} placeholder="Describe the role, style, or project" aria-label="Audio sample description" rows={3} />
    <input ref={fileRef} type="file" accept={ACCEPT_AUDIO} disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} aria-label="Upload public audio sample" className="block w-full text-sm text-neutral-400" />
    <p className="text-xs text-neutral-500">MP3, M4A, WAV, OGG, FLAC, AAC, WebM · up to 15MB. {busy && 'Uploading…'}</p>
    {error && <p role="alert" className="text-sm text-[#FF5C3A]">{error}</p>}
  </div>;
}

export function AudioSaleEditor({ userId, work }: { userId: string; work: ArtisanWork }) {
  const [enabled, setEnabled] = useState(false);
  const [price, setPrice] = useState('');
  const [license, setLicense] = useState('');
  const [original, setOriginal] = useState<File | null>(null);
  const [filename, setFilename] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [feeBps, setFeeBps] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    fetch(`/api/artisan/audio?work=${work.id}`).then(r => r.ok ? r.json() : null).then(data => {
      if (typeof data?.fee_bps === 'number') setFeeBps(data.fee_bps);
      if (!data?.offer) return;
      setEnabled(data.offer.enabled); setPrice((data.offer.price_cents / 100).toFixed(2));
      setLicense(data.offer.license); setFilename(data.offer.filename);
    }).catch(() => {});
  }, [work.id]);
  async function save() {
    setBusy(true); setMessage('');
    try {
      let path: string | undefined;
      if (enabled && original) {
        const { ext, type } = audioFile(original, true);
        path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient().storage.from('artisan-audio-originals').upload(path, original, { contentType: type, upsert: false });
        if (error) throw error;
      }
      const r = await fetch('/api/artisan/audio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action: 'save', workId: work.id, enabled, price_cents: Math.round(Number(price) * 100), license,
        private_path: path, filename: original?.name || filename, acceptedSellerTerms: accepted ? '2026-11-10' : null,
        acceptedFeeBps: feeBps,
      }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMessage(enabled ? 'Recording is available for purchase.' : 'Portfolio only — sales are off.');
      if (original) setFilename(original.name);
      setOriginal(null);
    } catch (e) { setMessage((e as Error).message); }
    setBusy(false);
  }
  return <details className="border-t border-white/10 p-3 text-sm">
    <summary className="cursor-pointer text-[#FFC93C]">Optional recording sale</summary>
    <label className="mt-3 flex gap-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Offer a licensed download</label>
    {enabled && <div className="mt-3 space-y-3">
      <label className="block">Price (USD)<input type="number" min="0.50" max="10000" step="0.01" className={input} value={price} onChange={e => setPrice(e.target.value)} /></label>
      <label className="block">Private original (up to 50MB)<input type="file" accept={ACCEPT_AUDIO} onChange={e => setOriginal(e.target.files?.[0] || null)} className="mt-1 block w-full text-xs" /></label>
      {filename && <p className="break-all text-xs text-neutral-400">Saved original: {filename}</p>}
      <p className="text-xs text-neutral-400">Upload the full recording here. The public sample remains playable for everyone. Existing buyers keep their purchased version and license.</p>
      <label className="block">Buyer’s license<textarea className={input} rows={4} minLength={10} maxLength={3000} value={license} onChange={e => setLicense(e.target.value)} placeholder="State permitted uses, commercial rights, attribution, redistribution, and any voice/AI restrictions." /></label>
      <p className="text-xs text-neutral-400">Platform fee: {feeBps === null ? 'unavailable — refresh before selling' : `${feeBps / 100}%`}. Your share: {feeBps === null ? '—' : `${100 - feeBps / 100}%`} before refunds or disputes. Standard card processing is covered by NorthEDM’s share.</p>
      <label className="flex items-start gap-2 text-xs text-neutral-400"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>I own or have permission to license this recording and accept the <Link href="/audio/terms" className="underline">audio seller terms</Link> and the fee shown above.</span></label>
    </div>}
    <button disabled={busy || (enabled && (!accepted || feeBps === null))} onClick={save} className="mt-3 rounded-lg border border-white/20 px-3 py-2 disabled:opacity-40">{busy ? 'Saving…' : 'Save sale setting'}</button>
    {message && <p role="status" className="mt-2 text-xs text-neutral-300">{message}</p>}
  </details>;
}

export function ArtisanAudioPayouts() {
  const [status, setStatus] = useState<{ connected: boolean; ready: boolean; country?: string; fee_bps?: number } | null>(null);
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch('/api/artisan/stripe');
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setStatus(data);
  }
  async function connect(action: string) {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/artisan/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, country }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <details className="mt-5 rounded-xl border border-white/10 p-4" onToggle={e => { if (e.currentTarget.open && !status) void load().catch(e => setError(e.message)); }}>
    <summary className="cursor-pointer text-sm text-[#FFC93C]">Audio sales &amp; bank payouts (optional)</summary>
    <p className="mt-3 text-sm text-neutral-400">Free portfolio samples need no bank account. To sell recordings, complete Stripe’s identity and bank setup using your own account. NorthEDM does not collect your bank details.</p>
    {status && <><p className="mt-3 text-sm">{status.ready ? 'Payout setup is complete.' : status.connected ? 'Complete your Stripe setup to enable sales.' : 'No audio payout account connected.'}</p>
      <p className="mt-2 text-xs text-neutral-400">NorthEDM’s fee is {(Number(status.fee_bps) / 100).toFixed(2)}% per audio sale; the rest goes to your connected Stripe balance. NorthEDM covers standard card processing from its fee. Refunds and disputes may reverse earnings. Bank deposits follow Stripe’s payout schedule, with a possible initial waiting period.</p>
      {!status.connected && <label className="mt-3 block text-sm">Your country (two-letter code)<input className={`${input} mt-1 max-w-28`} value={country} maxLength={2} onChange={e => setCountry(e.target.value.toUpperCase())} placeholder="US" /></label>}
      <div className="mt-3 flex flex-wrap gap-3"><button disabled={busy || (!status.connected && country.length !== 2)} onClick={() => connect('onboard')} className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40">{status.connected ? 'Continue bank setup' : 'Connect my bank with Stripe'}</button>
        {status.ready && <button disabled={busy} onClick={() => connect('dashboard')} className="text-sm text-[#FFC93C] underline">View payouts / update bank</button>}
        <button onClick={() => void load().catch(e => setError(e.message))} className="text-sm underline">Refresh status</button></div>
      <AudioPurchases selling />
    </>}
    {error && <p role="alert" className="mt-2 text-sm text-[#FF5C3A]">{error}</p>}
    <Link href="/audio/purchases" className="mt-4 block text-sm text-[#FFC93C] underline">My purchased recordings</Link>
  </details>;
}
