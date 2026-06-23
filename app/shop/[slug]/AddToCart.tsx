"use client";
import { useState } from "react";
import Link from "next/link";
import { useCart, type CartLine } from "@/app/shop/useCart";

export default function AddToCart({
  product, stock,
}: {
  product: Omit<CartLine, "qty">;
  stock: number;
}) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (stock <= 0) {
    return <p className="font-dm-mono text-sm uppercase tracking-widest text-[#FF5C3A]">Sold out</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-xl border border-white/10">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 text-neutral-400 hover:text-white">−</button>
          <span className="w-10 text-center font-dm-mono text-sm">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(stock, q + 1))} className="px-3 py-2 text-neutral-400 hover:text-white">+</button>
        </div>
        <span className="font-dm-mono text-xs text-neutral-600">{stock} in stock</span>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => { add(product, qty); setAdded(true); setTimeout(() => setAdded(false), 1800); }}
          className="rounded-xl bg-[#39FF14] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        >
          {added ? "Added ✓" : "Add to cart"}
        </button>
        <Link href="/shop/cart" className="rounded-xl border border-white/10 px-6 py-3 text-sm text-neutral-300 transition hover:bg-white/5">
          View cart →
        </Link>
      </div>
    </div>
  );
}
