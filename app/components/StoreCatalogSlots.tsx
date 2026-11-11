'use client';

import { useEffect, useState } from 'react';

type Catalog = {
  options: { id: number; name: string; sizes: number }[];
  selected: number[];
  limit: number;
  active_limit: number | null;
  pending_limit: number | null;
};

export function StoreCatalogSlots({ slug, onSaved }: { slug: string; onSaved?: () => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/store/${encodeURIComponent(slug)}/catalog`;

  useEffect(() => {
    let current = true;
    fetch(endpoint).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (current) {
        setCatalog(data);
        setSelected(data.selected);
      }
    }).catch(e => { if (current) setMessage(e.message); });
    return () => { current = false; };
  }, [endpoint]);

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage('Storefront selection saved.');
      onSaved?.();
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }

  const options = catalog?.options ?? [];
  const known = new Set(options.map(option => option.id));
  const shown = [...options, ...selected.filter(id => !known.has(id)).map(id => ({ id, name: `Unavailable listing ${id}`, sizes: 0 }))]
    .filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="my-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
    <h2 className="font-semibold text-white">Storefront listings</h2>
    {catalog && <>
      <p className="mt-2 text-sm text-neutral-300">{selected.length} of {catalog.limit} slots selected</p>
      <p className="mt-1 text-sm text-neutral-400">Choose the products shown in this store. All sizes of a product share one slot. Sold-out listings use a slot while selected.</p>
      {catalog.active_limit === null && <p className="mt-2 text-xs text-neutral-400">Save your selection before subscribing. It takes effect when a slot plan starts.</p>}
      <label className="mt-4 block text-sm">Find a product
        <input value={query} onChange={event => setQuery(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
      </label>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {shown.length ? shown.map(option => {
          const checked = selected.includes(option.id);
          return <label key={option.id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
            <input type="checkbox" checked={checked} disabled={busy || (!checked && selected.length >= catalog.limit)} onChange={() => setSelected(ids => checked ? ids.filter(id => id !== option.id) : [...ids, option.id])} />
            <span className="min-w-0 flex-1 break-words">{option.name}</span>
            {option.sizes > 1 && <span className="text-xs text-neutral-400">{option.sizes} sizes</span>}
          </label>;
        }) : <p className="text-sm text-neutral-400">No matching products.</p>}
      </div>
      <button disabled={busy} onClick={save} className="mt-4 rounded-xl bg-[#39FF14] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Saving…' : 'Save storefront selection'}</button>
    </>}
    {!catalog && !message && <p className="mt-2 text-sm text-neutral-400">Loading listings…</p>}
    {message && <p role="status" className="mt-2 text-sm text-neutral-300">{message}</p>}
  </section>;
}
