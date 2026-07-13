"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/app/shop/useCart";

type Promo = { code: string; percent_off: number; promoter_name: string | null };

export default function CartPage() {
  const { cart, setQty, remove, subtotal } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promo, setPromo] = useState("");
  const [promoInfo, setPromoInfo] = useState<Promo | null>(null);
  const [promoMsg, setPromoMsg] = useState("");
  const [applying, setApplying] = useState(false);

  // Reflect an already-applied code (e.g. from scanning a hoodie).
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )ne_hoodie=([^;]+)/);
    if (!m) return;
    fetch(`/api/hoodie?code=${encodeURIComponent(decodeURIComponent(m[1]))}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setPromoInfo({ code: j.code, percent_off: j.percent_off, promoter_name: j.promoter_name }); })
      .catch(() => {});
  }, []);

  async function applyPromo() {
    const code = promo.trim();
    if (!code) return;
    setApplying(true); setPromoMsg("");
    const r = await fetch(`/api/hoodie?code=${encodeURIComponent(code)}&apply=1`);
    const j = await r.json().catch(() => ({}));
    setApplying(false);
    if (!j.ok) { setPromoMsg("That code isn't valid."); return; }
    setPromoInfo({ code: j.code, percent_off: j.percent_off, promoter_name: j.promoter_name });
    setPromo("");
  }

  async function checkout() {
    setLoading(true); setError("");
    const res = await fetch("/api/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map((c) => ({ id: c.id, qty: c.qty })) }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) { setError(j.error ?? "Checkout failed."); setLoading(false); return; }
    window.location.href = j.url;
  }

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/shop" className="font-dm-mono text-xs text-neutral-500 hover:text-neutral-300">← Continue shopping</Link>
        <h1 className="mt-3 mb-8 font-bebas text-5xl tracking-wide">Cart</h1>

        {cart.length === 0 ? (
          <p className="text-neutral-500">Your cart is empty. <Link href="/shop" className="text-[#39FF14] hover:underline">Browse the shop →</Link></p>
        ) : (
          <>
            <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
              {cart.map((c) => (
                <div key={c.id} className="flex items-center gap-4 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image || "/northedm-logo.svg"} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{c.name}</p>
                    <p className="font-dm-mono text-xs text-neutral-500">${(c.price_cents / 100).toFixed(2)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-white/10">
                        <button onClick={() => setQty(c.id, c.qty - 1)} className="px-2.5 py-1 text-neutral-400 hover:text-white">−</button>
                        <span className="w-8 text-center font-dm-mono text-sm">{c.qty}</span>
                        <button onClick={() => setQty(c.id, c.qty + 1)} className="px-2.5 py-1 text-neutral-400 hover:text-white">+</button>
                      </div>
                      <button onClick={() => remove(c.id)} className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-600 hover:text-[#FF5C3A]">Remove</button>
                    </div>
                  </div>
                  <span className="shrink-0 font-dm-mono text-sm text-neutral-300">${((c.price_cents * c.qty) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <span className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Subtotal</span>
              <span className="font-bebas text-3xl text-[#39FF14]">${(subtotal / 100).toFixed(2)}</span>
            </div>
            <p className="mt-1 text-right font-dm-mono text-[11px] text-neutral-600">Shipping calculated at checkout.</p>

            {/* Promo / hoodie code */}
            {promoInfo ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/[0.06] px-4 py-3 text-sm">
                <span>
                  <span className="font-dm-mono text-[#39FF14]">✓ {promoInfo.code}</span>{" "}
                  <span className="text-neutral-300">— {promoInfo.percent_off}% off applies at checkout</span>
                  {promoInfo.promoter_name ? <span className="text-neutral-500"> · {promoInfo.promoter_name}</span> : null}
                </span>
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex gap-2">
                  <input
                    value={promo}
                    onChange={(e) => { setPromo(e.target.value.toUpperCase()); setPromoMsg(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyPromo(); }}
                    placeholder="Promo / hoodie code"
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-dm-mono text-sm tracking-widest text-neutral-100 placeholder:tracking-normal placeholder:text-neutral-600 focus:border-[#00D4FF]/40 focus:outline-none"
                  />
                  <button
                    onClick={applyPromo}
                    disabled={applying || !promo.trim()}
                    className="shrink-0 rounded-xl bg-[#00D4FF] px-5 py-3 font-dm-mono text-xs font-bold uppercase tracking-widest text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {applying ? "…" : "Apply"}
                  </button>
                </div>
                {promoMsg && <p className="mt-2 text-sm text-[#FF5C3A]">{promoMsg}</p>}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-[#FF5C3A]">{error}</p>}

            <button onClick={checkout} disabled={loading}
              className="mt-5 w-full rounded-2xl bg-[#39FF14] py-4 text-lg font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
              {loading ? "Redirecting to secure checkout…" : "Checkout"}
            </button>
            <Link href="/shop"
              className="mt-3 block w-full rounded-2xl border border-white/15 py-3.5 text-center text-base font-medium text-neutral-200 transition hover:bg-white/5">
              ← Keep Shopping
            </Link>
            <p className="mt-3 text-center font-dm-mono text-[11px] text-neutral-600">🔒 Secure payment via Stripe</p>
          </>
        )}
      </div>
    </main>
  );
}
