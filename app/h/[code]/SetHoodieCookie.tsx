"use client";

import { useEffect } from "react";

// Persists the scanned hoodie code so shop checkout can attribute the order to
// its promoter. A plain (non-HttpOnly) cookie the checkout route reads server-side.
export function SetHoodieCookie({ code }: { code: string }) {
  useEffect(() => {
    const week = 60 * 60 * 24 * 7;
    document.cookie = `ne_hoodie=${encodeURIComponent(code)}; path=/; max-age=${week}; samesite=lax`;
    try {
      localStorage.setItem("ne_hoodie", code);
    } catch {
      /* ignore */
    }
  }, [code]);
  return null;
}
