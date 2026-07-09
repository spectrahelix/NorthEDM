"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "./useCart";

// Floating cart button + slide-out drawer. The button shows the item count and
// opens the drawer; the drawer also pops open whenever an item is added.
export function ShopCart() {
  const { cart, setQty, remove, count, subtotal } = useCart();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onAdd = () => setOpen(true);
    window.addEventListener("ne-cart-added", onAdd);
    return () => window.removeEventListener("ne-cart-added", onAdd);
  }, []);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function checkout() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map((c) => ({ id: c.id, qty: c.qty })) }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) {
      setError(j.error ?? "Checkout failed.");
      setLoading(false);
      return;
    }
    window.location.href = j.url;
  }

  return (
    <>
      {/* Floating cart button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open cart"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#39FF14] text-black shadow-lg transition hover:opacity-90 active:scale-95"
      >
        <span className="text-xl">🛒</span>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#CC00FF] px-1.5 font-dm-mono text-xs font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-neutral-950 text-neutral-100 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="font-bebas text-2xl tracking-wide">Your Cart {count > 0 && `(${count})`}</h2>
              <button onClick={() => setOpen(false)} aria-label="Close cart" className="rounded-lg px-2 text-neutral-500 hover:text-white">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <p className="mt-8 text-center text-sm text-neutral-500">Your cart is empty.</p>
              ) : (
                <div className="space-y-3">
                  {cart.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.image || "/northedm-logo.svg"} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                        <p className="font-dm-mono text-xs text-neutral-500">${(c.price_cents / 100).toFixed(2)}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex items-center rounded-lg border border-white/10">
                            <button onClick={() => setQty(c.id, c.qty - 1)} className="px-2 py-0.5 text-neutral-400 hover:text-white">−</button>
                            <span className="w-7 text-center font-dm-mono text-xs">{c.qty}</span>
                            <button onClick={() => setQty(c.id, c.qty + 1)} className="px-2 py-0.5 text-neutral-400 hover:text-white">+</button>
                          </div>
                          <button onClick={() => remove(c.id)} className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-[#FF5C3A]">Remove</button>
                        </div>
                      </div>
                      <span className="shrink-0 font-dm-mono text-xs text-neutral-300">${((c.price_cents * c.qty) / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Subtotal</span>
                <span className="font-bebas text-2xl text-[#39FF14]">${(subtotal / 100).toFixed(2)}</span>
              </div>
              {error && <p className="mb-2 text-sm text-[#FF5C3A]">{error}</p>}
              <button
                onClick={checkout}
                disabled={loading || cart.length === 0}
                className="w-full rounded-xl bg-[#39FF14] py-3 text-base font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
              >
                {loading ? "Redirecting…" : "Checkout"}
              </button>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm text-neutral-200 transition hover:bg-white/5"
                >
                  ← Keep Shopping
                </button>
                <Link
                  href="/shop/cart"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-white/15 py-2.5 text-center text-sm text-neutral-200 transition hover:bg-white/5"
                >
                  View full cart
                </Link>
              </div>
              <p className="mt-2 text-center font-dm-mono text-[10px] text-neutral-600">🔒 Secure payment via Stripe</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
