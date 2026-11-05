"use client";
import { useState } from "react";
import { ShipTo, type ShipChoice } from "@/app/components/ShipTo";

/**
 * "What will shipping cost?" on an item page, before anything is in a cart:
 * the same quote the checkout uses (utils/shipping.ts via /api/shipping/quote),
 * for this item and quantity, to any country. Nothing here is charged.
 */
export function ShipEstimate({ productId, accent }: { productId: number | string; accent?: string }) {
  const [qty, setQty] = useState(1);
  const [ship, setShip] = useState<ShipChoice>({ country: "US", service: null });
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Estimate shipping</p>
        <label className="flex items-center gap-2 text-xs text-neutral-400">Qty
          <input type="number" min={1} max={50} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-neutral-100 outline-none" />
        </label>
      </div>
      <ShipTo kind="store" items={[{ id: productId, qty }]} value={ship} onChange={(v) => setShip(v)} accent={accent} />
    </div>
  );
}
