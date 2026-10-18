"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductThumb } from "@/app/components/ProductThumb";

export type StoreProduct = {
  id: number; name: string; price_cents: number; vendor_name: string | null;
  image_url: string | null; href: string;
};

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Cart for an embedded store. Quantities live only in this component — the server
// re-reads every price and stock count at checkout, so nothing here is trusted.
export function StoreCart({
  slug, products, accent, canOrder, closedReason, displayFont = null, cardBg,
}: {
  slug: string;
  products: StoreProduct[];
  accent: string;
  /** The shop's display font for names and prices, or null for standard. */
  displayFont?: string | null;
  cardBg?: string;
  canOrder: boolean;
  closedReason?: string;
}) {
  const [qty, setQty] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const lines = products
    .map((p) => ({ p, n: qty[p.id] ?? 0 }))
    .filter((l) => l.n > 0);
  const count = lines.reduce((s, l) => s + l.n, 0);
  const subtotal = lines.reduce((s, l) => s + l.p.price_cents * l.n, 0);

  // Keep the drawer honest: an emptied cart shouldn't leave it hanging open.
  useEffect(() => { if (count === 0) setOpen(false); }, [count]);

  function bump(id: number, delta: number) {
    setQty((q) => {
      const next = Math.max(0, (q[id] ?? 0) + delta);
      const copy = { ...q };
      if (next === 0) delete copy[id]; else copy[id] = next;
      return copy;
    });
  }

  async function checkout() {
    setBusy(true); setError("");
    const res = await fetch(`/api/store/${slug}/checkout`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: lines.map((l) => ({ id: l.p.id, qty: l.n })) }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) { setError(j.error || "Couldn't start checkout."); setBusy(false); return; }
    window.location.href = j.url;
  }

  return (
    <>
      {/* One card per item: photo (opens the item and its gallery), details, and
          the Add control together. It used to be a photo grid with a second,
          separate list of Add buttons underneath — every item shown twice. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => {
          const n = qty[p.id] ?? 0;
          const priced = p.price_cents > 0;
          return (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]" style={cardBg ? { background: cardBg } : undefined}>
              <Link href={p.href} className="block transition hover:opacity-90">
                <ProductThumb src={p.image_url} alt={p.name} />
              </Link>
              <div className="flex flex-1 flex-col p-3">
                <Link href={p.href} className="line-clamp-2 text-sm font-semibold text-white hover:underline" style={displayFont ? { fontFamily: displayFont, fontWeight: 400, fontSize: "0.95rem" } : undefined}>{p.name}</Link>
                {p.vendor_name && <p className="mt-0.5 truncate font-dm-mono text-[10px] text-neutral-500">{p.vendor_name}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <p className={`text-xl ${displayFont ? "" : "font-bebas"}`} style={{ color: accent, ...(displayFont ? { fontFamily: displayFont } : {}) }}>{priced ? money(p.price_cents) : "—"}</p>
                  {n === 0 ? (
                    <button
                      onClick={() => bump(p.id, 1)}
                      disabled={!canOrder || !priced}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: accent }}
                    >
                      Add
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => bump(p.id, -1)} aria-label={`Remove one ${p.name}`}
                        className="h-7 w-7 rounded-lg border border-white/15 text-neutral-300 hover:bg-white/5">−</button>
                      <span className="w-4 text-center font-dm-mono text-sm">{n}</span>
                      <button onClick={() => bump(p.id, 1)} aria-label={`Add one ${p.name}`}
                        className="h-7 w-7 rounded-lg border border-white/15 text-neutral-300 hover:bg-white/5">+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!canOrder && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-neutral-400">
          {closedReason || "This store isn't accepting orders yet."}
        </p>
      )}

      {/* Sticky cart bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
              <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">
                {count} item{count === 1 ? "" : "s"} · tap to {open ? "hide" : "review"}
              </p>
              <p className="font-bebas text-2xl" style={{ color: accent }}>{money(subtotal)}</p>
            </button>
            <button
              onClick={checkout}
              disabled={busy || !canOrder}
              className="shrink-0 rounded-2xl px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              style={{ background: accent }}
            >
              {busy ? "Starting…" : "Checkout"}
            </button>
          </div>
          {open && (
            <div className="mx-auto mt-3 max-w-6xl space-y-1 border-t border-white/10 pt-3">
              {lines.map((l) => (
                <div key={l.p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-neutral-300">{l.n} × {l.p.name}</span>
                  <span className="shrink-0 font-dm-mono text-neutral-400">{money(l.p.price_cents * l.n)}</span>
                </div>
              ))}
            </div>
          )}
          {error && <p className="mx-auto mt-2 max-w-6xl text-sm text-[#FF5C3A]">{error}</p>}
          <p className="mx-auto mt-2 max-w-6xl text-center font-dm-mono text-[10px] text-neutral-600">🔒 Secure payment via Stripe</p>
        </div>
      )}
    </>
  );
}
