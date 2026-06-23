"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/app/shop/useCart";

export default function SuccessPage() {
  const { clear } = useCart();
  useEffect(() => { clear(); }, [clear]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
      <div className="max-w-md text-center">
        <div className="mb-4 text-5xl">✅</div>
        <h1 className="font-bebas text-5xl tracking-wide">Order placed!</h1>
        <p className="mt-3 text-neutral-400">
          Thanks for your order — a confirmation is on its way to your email, and we&apos;ll get it shipped out.
        </p>
        <Link href="/shop" className="mt-8 inline-block rounded-2xl bg-[#39FF14] px-6 py-3 font-semibold text-black transition hover:opacity-90">
          Back to the shop
        </Link>
      </div>
    </main>
  );
}
