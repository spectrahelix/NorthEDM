"use client";
import { useEffect, useState, useCallback } from "react";

export type CartLine = {
  id: string; slug: string; name: string; price_cents: number; image: string | null; qty: number;
};

const KEY = "ne_cart";

function read(): CartLine[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(c: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(c));
  window.dispatchEvent(new Event("ne-cart"));
}

export function useCart() {
  const [cart, setCart] = useState<CartLine[]>([]);
  useEffect(() => {
    const sync = () => setCart(read());
    sync();
    window.addEventListener("ne-cart", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("ne-cart", sync); window.removeEventListener("storage", sync); };
  }, []);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    const c = read();
    const e = c.find((x) => x.id === line.id);
    if (e) e.qty += qty; else c.push({ ...line, qty });
    write(c);
  }, []);
  const setQty = useCallback((id: string, qty: number) => {
    write(read().map((x) => (x.id === id ? { ...x, qty } : x)).filter((x) => x.qty > 0));
  }, []);
  const remove = useCallback((id: string) => write(read().filter((x) => x.id !== id)), []);
  const clear = useCallback(() => write([]), []);

  const count = cart.reduce((s, x) => s + x.qty, 0);
  const subtotal = cart.reduce((s, x) => s + x.price_cents * x.qty, 0);
  return { cart, add, setQty, remove, clear, count, subtotal };
}
