"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductThumb } from "@/app/components/ProductThumb";
import { groupVariants } from "@/utils/productVariants";

/**
 * "Edit shop" view of a storefront, for its operator (or an admin): every item
 * of the store, one card per item (sizes grouped, utils/productVariants.ts),
 * with each size's price, stock and "On sale" editable in place. One
 * **Save changes** button, at the top and at the bottom, saves every size that
 * changed (owner, 2026-11-05) through the same route the inventory dashboard
 * uses (/api/vendor/products/[id]), which checks the caller owns the item.
 * Anything more (photos, description, specs) is the dashboard's job — "Full
 * edit" goes there.
 */
export type EditableItem = {
  id: number; name: string | null; price: number | null; inventory_count: number | null;
  status: string | null; is_public: boolean | null; image_url: string | null;
  variant_of: number | null; variant_label: string | null; source: string | null;
};

type Draft = { price: string; stock: string; onSale: boolean };
const initial = (i: EditableItem): Draft => ({
  price: String(Number(i.price ?? 0) || ""),
  stock: String(i.inventory_count ?? 0),
  onSale: i.status === "published" && !!i.is_public,
});
const parsed = (d: Draft) => ({ p: Number(d.price), n: Math.max(0, Math.floor(Number(d.stock) || 0)) });
function isDirty(i: EditableItem, d: Draft) {
  const { p, n } = parsed(d);
  const was = initial(i);
  return p !== (Number(i.price ?? 0) || 0) || n !== (i.inventory_count ?? 0) || d.onSale !== was.onSale;
}

export function ShopEditor({ items, accent, currencySymbol = "$" }: { items: EditableItem[]; accent: string; currencySymbol?: string }) {
  const router = useRouter();
  const groups = groupVariants(items);
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => Object.fromEntries(items.map((i) => [i.id, initial(i)])));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const editable = items.filter((i) => i.source !== "square");
  const changed = editable.filter((i) => drafts[i.id] && isDirty(i, drafts[i.id]));
  const draftOf = (i: EditableItem) => drafts[i.id] ?? initial(i);

  function update(item: EditableItem, patch: Partial<Draft>) {
    const id = item.id;
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? initial(item)), ...patch } }));
    setErrors((e) => { if (!e[id]) return e; const n = { ...e }; delete n[id]; return n; });
    setNote("");
  }

  async function saveAll() {
    if (!changed.length) return;
    const errs: Record<number, string> = {};
    for (const i of changed) if (draftOf(i).onSale && !(parsed(draftOf(i)).p > 0)) errs[i.id] = "Set a price before putting it on sale.";
    if (Object.keys(errs).length) { setErrors(errs); setNote("Some sizes need a price before they can go on sale — see the red notes."); return; }
    setSaving(true); setNote("");
    const results = await Promise.all(changed.map(async (i) => {
      const d = draftOf(i); const { p, n } = parsed(d);
      const res = await fetch(`/api/vendor/products/${i.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ price: p || 0, inventoryCount: n, status: d.onSale ? "published" : "draft", isPublic: d.onSale }),
      }).catch(() => null);
      if (!res || !res.ok) {
        const j = res ? await res.json().catch(() => ({})) : {};
        return { id: i.id, error: (j as { error?: string }).error || "Couldn't save." };
      }
      return { id: i.id, error: null };
    }));
    const failed = results.filter((r) => r.error);
    setErrors(Object.fromEntries(failed.map((r) => [r.id, r.error as string])));
    setSaving(false);
    setNote(failed.length ? `Saved ${results.length - failed.length} of ${results.length}. The ones in red didn't save.` : `Saved ${results.length} change${results.length === 1 ? "" : "s"} ✓`);
    router.refresh();
  }

  if (!groups.length) {
    return (
      <div className="rounded-2xl border border-white/15 bg-black/30 p-6">
        <p className="font-semibold text-white">No items yet.</p>
        <Link href="/vendor/dashboard" className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-black" style={{ background: accent }}>Add your first item →</Link>
      </div>
    );
  }

  // Sizes switched On sale that customers still can't see (stock 0 or no price).
  const hiddenOnSale = items.filter((i) => {
    const d = draftOf(i); const { p, n } = parsed(d);
    return d.onSale && (!(p > 0) || n <= 0);
  });
  const hiddenNames = hiddenOnSale.map((i) => i.name ?? "Item");

  const saveBar = (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={saveAll} disabled={!changed.length || saving}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
        style={{ background: accent }}>
        {saving ? "Saving…" : changed.length ? `Save changes (${changed.length})` : "Save changes"}
      </button>
      <span className="text-xs text-neutral-400">{note || (changed.length ? "Unsaved changes" : "No changes yet")}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {hiddenOnSale.length > 0 && (
        <div className="rounded-xl border border-[#FF5C3A]/40 bg-[#FF5C3A]/10 px-4 py-3 text-sm text-[#FFB4A3]">
          <p className="font-semibold text-white">
            {hiddenOnSale.length} size{hiddenOnSale.length === 1 ? " is" : "s are"} on sale but hidden from customers. Enter a stock number above 0{hiddenOnSale.some((i) => !(parsed(draftOf(i)).p > 0)) ? " and a price" : ""}, then Save changes.
          </p>
          <p className="mt-1 text-xs">{hiddenNames.slice(0, 8).join(" · ")}{hiddenNames.length > 8 ? ` · +${hiddenNames.length - 8} more` : ""}</p>
        </div>
      )}
      {saveBar}
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className="overflow-hidden rounded-2xl border border-white/15 bg-black/30">
            <div className="flex gap-3 p-3">
              <div className="w-20 shrink-0 overflow-hidden rounded-xl"><ProductThumb src={g.image_url} alt={g.title} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-white">{g.options.length > 1 ? g.title : (g.lead.name ?? "Item")}</p>
                <Link href="/vendor/dashboard" className="mt-1 inline-block font-dm-mono text-[11px] underline hover:opacity-80" style={{ color: accent }}>
                  Full edit (photos, description) →
                </Link>
              </div>
            </div>
            <div className="divide-y divide-white/10 border-t border-white/10">
              {g.options.map((o) => (
                <SizeRow key={o.id} item={o} draft={drafts[o.id] ?? initial(o)} error={errors[o.id]} sized={g.options.length > 1}
                  accent={accent} currencySymbol={currencySymbol} onChange={(patch) => update(o, patch)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {saveBar}
    </div>
  );
}

function SizeRow({ item, draft, error, sized, accent, currencySymbol, onChange }: {
  item: EditableItem; draft: Draft; error?: string; sized: boolean; accent: string; currencySymbol: string; onChange: (patch: Partial<Draft>) => void;
}) {
  const locked = item.source === "square";
  const { p, n } = parsed(draft);
  const hidden = draft.onSale && (!(p > 0) || n <= 0);
  const dirty = isDirty(item, draft);
  return (
    <div className={`px-3 py-2.5 ${dirty ? "bg-white/[0.03]" : ""}`}>
      <div className="flex flex-wrap items-end gap-2">
        <p className="w-14 shrink-0 pb-2 text-sm font-semibold text-white">{sized ? item.variant_label ?? "—" : "Item"}</p>
        <label className="w-24">
          <span className="block font-dm-mono text-[10px] uppercase tracking-wider text-neutral-500">Price</span>
          <span className="flex items-center rounded-lg border border-white/15 bg-black/40 px-2">
            <span className="text-sm text-neutral-500">{currencySymbol}</span>
            <input inputMode="decimal" value={draft.price} disabled={locked} onChange={(e) => onChange({ price: e.target.value.replace(/[^0-9.]/g, "") })}
              className="w-full bg-transparent py-1.5 pl-1 text-sm text-white outline-none" aria-label={`Price ${item.variant_label ?? ""}`} />
          </span>
        </label>
        <label className="w-20">
          <span className="block font-dm-mono text-[10px] uppercase tracking-wider text-neutral-500">Stock</span>
          <input inputMode="numeric" value={draft.stock} disabled={locked} onChange={(e) => onChange({ stock: e.target.value.replace(/[^0-9]/g, "") })}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none" aria-label={`Stock ${item.variant_label ?? ""}`} />
        </label>
        <button type="button" role="switch" aria-checked={draft.onSale} aria-label={`On sale ${item.variant_label ?? item.name ?? ""}`} disabled={locked} onClick={() => onChange({ onSale: !draft.onSale })}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${draft.onSale ? "text-black" : "border-white/15 text-neutral-300"}`}
          style={draft.onSale ? { background: accent, borderColor: accent } : undefined}>
          {draft.onSale ? "On sale" : "Off sale"}
        </button>
        {dirty && <span className="ml-auto pb-2 font-dm-mono text-[10px] uppercase tracking-wider text-[#FFC93C]">changed</span>}
      </div>
      {locked && <p className="mt-1 text-[11px] text-neutral-500">Synced from Square — edit it there.</p>}
      {hidden && <p className="mt-1 text-[11px] text-[#FFC93C]">Customers won&apos;t see it until it has a price and stock above 0.</p>}
      {error && <p className="mt-1 text-[11px] text-[#FF5C3A]">{error}</p>}
    </div>
  );
}
