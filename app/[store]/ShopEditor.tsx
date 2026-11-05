"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductThumb } from "@/app/components/ProductThumb";
import { groupVariants } from "@/utils/productVariants";

/**
 * "Edit shop" view of a storefront, for its operator (or an admin): every item
 * of the store, one card per item (sizes grouped, utils/productVariants.ts),
 * with each size's price, stock and "On sale" editable in place. Saves through
 * the same route the inventory dashboard uses (/api/vendor/products/[id]),
 * which checks the caller owns the item. Anything more (photos, description,
 * specs) is the dashboard's job — "Full edit" goes there.
 */
export type EditableItem = {
  id: number; name: string | null; price: number | null; inventory_count: number | null;
  status: string | null; is_public: boolean | null; image_url: string | null;
  variant_of: number | null; variant_label: string | null; source: string | null;
};

export function ShopEditor({ items, accent, currencySymbol = "$" }: { items: EditableItem[]; accent: string; currencySymbol?: string }) {
  const groups = groupVariants(items);
  if (!groups.length) {
    return (
      <div className="rounded-2xl border border-white/15 bg-black/30 p-6">
        <p className="font-semibold text-white">No items yet.</p>
        <Link href="/vendor/dashboard" className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-black" style={{ background: accent }}>Add your first item →</Link>
      </div>
    );
  }
  return (
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
            {g.options.map((o) => <SizeRow key={o.id} item={o} sized={g.options.length > 1} accent={accent} currencySymbol={currencySymbol} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SizeRow({ item, sized, accent, currencySymbol }: { item: EditableItem; sized: boolean; accent: string; currencySymbol: string }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(Number(item.price ?? 0) || ""));
  const [stock, setStock] = useState(String(item.inventory_count ?? 0));
  const [onSale, setOnSale] = useState(item.status === "published" && !!item.is_public);
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const [msg, setMsg] = useState("");
  const locked = item.source === "square";

  const p = Number(price), n = Math.max(0, Math.floor(Number(stock) || 0));
  const dirty = p !== Number(item.price ?? 0) || n !== (item.inventory_count ?? 0) || onSale !== (item.status === "published" && !!item.is_public);
  const hidden = onSale && (!(p > 0) || n <= 0);

  async function save() {
    if (onSale && !(p > 0)) { setState("error"); setMsg("Set a price before putting it on sale."); return; }
    setState("saving"); setMsg("");
    const res = await fetch(`/api/vendor/products/${item.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ price: p || 0, inventoryCount: n, status: onSale ? "published" : "draft", isPublic: onSale }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setState("error"); setMsg(j.error || "Couldn't save."); return; }
    setState("saved");
    router.refresh();
  }

  return (
    <div className="px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <p className="w-14 shrink-0 pb-2 text-sm font-semibold text-white">{sized ? item.variant_label ?? "—" : "Item"}</p>
        <label className="w-24">
          <span className="block font-dm-mono text-[10px] uppercase tracking-wider text-neutral-500">Price</span>
          <span className="flex items-center rounded-lg border border-white/15 bg-black/40 px-2">
            <span className="text-sm text-neutral-500">{currencySymbol}</span>
            <input inputMode="decimal" value={price} disabled={locked} onChange={(e) => { setPrice(e.target.value.replace(/[^0-9.]/g, "")); setState(""); }}
              className="w-full bg-transparent py-1.5 pl-1 text-sm text-white outline-none" aria-label={`Price ${item.variant_label ?? ""}`} />
          </span>
        </label>
        <label className="w-20">
          <span className="block font-dm-mono text-[10px] uppercase tracking-wider text-neutral-500">Stock</span>
          <input inputMode="numeric" value={stock} disabled={locked} onChange={(e) => { setStock(e.target.value.replace(/[^0-9]/g, "")); setState(""); }}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none" aria-label={`Stock ${item.variant_label ?? ""}`} />
        </label>
        <button type="button" role="switch" aria-checked={onSale} aria-label={`On sale ${item.variant_label ?? item.name ?? ""}`} disabled={locked} onClick={() => { setOnSale((v) => !v); setState(""); }}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${onSale ? "text-black" : "border-white/15 text-neutral-300"}`}
          style={onSale ? { background: accent, borderColor: accent } : undefined}>
          {onSale ? "On sale" : "Off sale"}
        </button>
        <button type="button" onClick={save} aria-label={`Save ${item.variant_label ?? item.name ?? ""}`} disabled={!dirty || state === "saving" || locked}
          className="ml-auto rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 disabled:opacity-30">
          {state === "saving" ? "Saving…" : state === "saved" && !dirty ? "Saved ✓" : "Save"}
        </button>
      </div>
      {locked && <p className="mt-1 text-[11px] text-neutral-500">Synced from Square — edit it there.</p>}
      {hidden && <p className="mt-1 text-[11px] text-[#FFC93C]">Customers won&apos;t see it until it has a price and stock above 0.</p>}
      {msg && <p className="mt-1 text-[11px] text-[#FF5C3A]">{msg}</p>}
    </div>
  );
}
