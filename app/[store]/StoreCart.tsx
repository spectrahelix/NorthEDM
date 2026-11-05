"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductThumb } from "@/app/components/ProductThumb";
import { formatMoney } from "@/utils/money";
import { METHOD_LABEL, WALLET_METHODS, type WalletMethod } from "@/utils/gambiaPay";
import { waychitCharge } from "@/utils/waychitFee";
import { IntlPaymentNote } from "@/app/components/IntlPaymentNote";
import { transferFeeCents } from "@/utils/localRules";
import { PaymentTimingNote } from "@/app/components/festdash/PaymentTimingNote";
import { ShipTo, type ShipChoice } from "@/app/components/ShipTo";
import { Price, ConversionNote } from "@/app/components/CurrencyContext";

export type StoreProduct = {
  id: number; name: string; price_cents: number; vendor_name: string | null;
  image_url: string | null; href: string;
};

type Wallet = { currency: string; numbers: { wave?: string | null; qmoney?: string | null; afrimoney?: string | null }; coordinator: string | null } | null;

// Cart for an embedded store. Quantities live only in this component — the server
// re-reads every price and stock count at checkout, so nothing here is trusted.
export function StoreCart({
  slug, products, accent, canOrder, closedReason, displayFont = null, cardBg, wallet = null, promoterCodeBps = 0, viewerIsPromoter = false,
}: {
  /** The signed-in buyer is an active promoter: their 5% applies on its own. */
  viewerIsPromoter?: boolean;
  /** NorthEDM brand shop: a promoter's code takes this off the items (utils/brandShop.ts). 0 = no code box. */
  promoterCodeBps?: number;
  slug: string;
  products: StoreProduct[];
  accent: string;
  /** Wallet-rail stores: the coordinator's wallet numbers and the shop's currency. */
  wallet?: Wallet;
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
  const currency = wallet?.currency ?? "USD";
  const money = (c: number) => formatMoney(c, currency);
  const [method, setMethod] = useState<WalletMethod | "card" | "waychit" | null>(null);
  const [promoCode, setPromoCode] = useState("");
  // Interim rule (utils/localRules.ts): Gambian stores take card / Google Pay
  // only for now, plus a transfer fee covering the owner's Remitly cost.
  const [localRules, setLocalRules] = useState<{ walletsEnabled: boolean; remitFeeBps: number } | null>(null);
  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/local-rules`).then((r) => r.json()).then((j) => {
      setLocalRules({ walletsEnabled: !!j.walletsEnabled, remitFeeBps: Number(j.remitFeeBps ?? 0) });
      if (!j.walletsEnabled) setMethod("card"); // the only way to pay for now
    }).catch(() => {});
  }, [wallet, currency]);
  const walletsOff = !!wallet && localRules !== null && !localRules.walletsEnabled;
  const walletOptions = wallet && !walletsOff ? WALLET_METHODS.filter((m) => !!wallet.numbers[m]) : [];
  // Waychit: Wave / QMoney / Afrimoney into NorthEDM's account, only while the owner has it on.
  const [waychit, setWaychit] = useState<{ enabled: boolean; fee_bps: number } | null>(null);
  useEffect(() => {
    if (!wallet) return;
    fetch("/api/waychit/status").then((r) => r.json()).then((j) => setWaychit({ enabled: !!j.enabled, fee_bps: Number(j.fee_bps ?? 300) })).catch(() => {});
  }, [wallet]);
  const [placed, setPlaced] = useState<{ orderId: string; payTo: string; method: WalletMethod; reference: string; total_cents: number; coordinator: string | null } | null>(null);
  const [ref, setRef] = useState("");
  const [ship, setShip] = useState<ShipChoice>({ country: "US", service: null });
  const [shipCents, setShipCents] = useState(0);
  const shipsParcels = !wallet; // Gambian (wallet-rail) stores hand over locally
  const [refDone, setRefDone] = useState(false);

  const lines = products
    .map((p) => ({ p, n: qty[p.id] ?? 0 }))
    .filter((l) => l.n > 0);
  const count = lines.reduce((s, l) => s + l.n, 0);
  const subtotal = lines.reduce((s, l) => s + l.p.price_cents * l.n, 0);
  const waychitOn = !!waychit?.enabled && !!wallet && currency === "GMD" && !walletsOff;
  const processingCents = waychitOn && method === "waychit" ? waychitCharge(subtotal, waychit!.fee_bps).processingFeeCents : 0;
  const remitCents = wallet && method === "card" && localRules ? transferFeeCents(subtotal, currency, localRules.remitFeeBps) : 0;
  // The promoter 5% is known here; a typed discount coupon is priced at checkout.
  const codeOffCents = promoterCodeBps > 0 && viewerIsPromoter ? Math.round((subtotal * promoterCodeBps) / 10000) : 0;

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
    if (wallet && !method) { setOpen(true); setError("Choose how you'll pay first."); return; }
    setBusy(true); setError("");
    const res = await fetch(`/api/store/${slug}/checkout`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: lines.map((l) => ({ id: l.p.id, qty: l.n })), paymentMethod: wallet ? method : undefined, country: ship.country, shippingService: ship.service, promoCode: promoterCodeBps > 0 && promoCode.trim() ? promoCode.trim() : undefined }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 401) { window.location.href = `/login?next=${encodeURIComponent(`/${slug}`)}`; return; }
    if (!res.ok) { setError(j.error || "Couldn't start checkout."); setBusy(false); return; }
    if (j.url) { window.location.href = j.url; return; }
    // Wallet order placed: show where to send the money and collect the reference.
    setPlaced(j); setBusy(false); setQty({});
  }
  async function sendRef() {
    if (!placed || !ref.trim()) return;
    setBusy(true); setError("");
    const res = await fetch(`/api/store/orders/${placed.orderId}/payment-ref`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(j.error || "Couldn't save that."); return; }
    setRefDone(true);
  }

  if (placed) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="font-dm-mono text-xs uppercase tracking-widest" style={{ color: accent }}>Order placed — pay now</p>
        <p className="mt-2 text-white">Send <span className="font-semibold">{money(placed.total_cents)}</span> by {METHOD_LABEL[placed.method]} to <span className="font-dm-mono">{placed.payTo}</span></p>
        <p className="mt-1 text-sm text-neutral-400">Put <span className="font-dm-mono text-white">{placed.reference}</span> in the transfer note. {placed.coordinator ?? "The coordinator"} confirms it in their wallet and the shop gets your order.</p>
        <PaymentTimingNote method={placed.method} />
        {refDone ? (
          <p className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Thanks — your transaction reference is in. You&apos;ll hear from the shop once the payment is confirmed.</p>
        ) : (
          <div className="mt-4 flex gap-2">
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction reference from your wallet app" className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none" />
            <button onClick={sendRef} disabled={busy || !ref.trim()} className="rounded-xl px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" style={{ background: accent }}>{busy ? "Saving…" : "Done, I paid"}</button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-[#FF5C3A]">{error}</p>}
      </div>
    );
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
                  {priced ? <Price cents={p.price_cents} currency={currency} className={`text-xl ${displayFont ? "" : "font-bebas"}`} style={{ color: accent, ...(displayFont ? { fontFamily: displayFont } : {}) }} /> : <p className="text-xl" style={{ color: accent }}>—</p>}
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
              <p className="font-bebas text-2xl" style={{ color: accent }}><Price cents={subtotal - codeOffCents + (shipsParcels ? shipCents : 0) + processingCents + remitCents} currency={currency} />{codeOffCents > 0 ? <span className="ml-2 font-dm-mono text-xs text-[#39FF14]">−{money(codeOffCents)} promoter discount</span> : null}{processingCents > 0 ? <span className="ml-2 font-dm-mono text-xs text-neutral-500">incl. {money(processingCents)} processing</span> : null}{remitCents > 0 ? <span className="ml-2 font-dm-mono text-xs text-neutral-500">incl. {money(remitCents)} transfer fee</span> : null}{shipsParcels && shipCents > 0 ? <span className="ml-2 font-dm-mono text-xs text-neutral-500">incl. {money(shipCents)} shipping</span> : null}</p>
            </button>
            <button
              onClick={checkout}
              disabled={busy || !canOrder}
              className="shrink-0 rounded-2xl px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              style={{ background: accent }}
            >
              {busy ? "Starting…" : wallet && method !== "card" && method !== "waychit" ? "Place order" : "Checkout"}
            </button>
          </div>
          {open && (
            <div className="mx-auto mt-3 max-w-6xl"><ConversionNote shopCurrency={currency} /></div>
          )}
          {open && shipsParcels && (
            <div className="mx-auto mt-3 max-w-6xl border-t border-white/10 pt-3">
              <ShipTo kind="store" items={lines.map((l) => ({ id: l.p.id, qty: l.n }))} value={ship} onChange={(v, cents) => { setShip(v); setShipCents(cents); }} accent={accent} />
            </div>
          )}
          {open && wallet && (
            <div className="mx-auto mt-3 max-w-6xl border-t border-white/10 pt-3">
              <p className="mb-2 font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">How will you pay?</p>
              {walletsOff && <p className="mb-2 text-xs text-neutral-400">For now this store takes <span className="text-white">card or Google Pay only</span>, with a transfer fee added to the order.</p>}
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => { setMethod("card"); setError(""); }}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${method === "card" ? "border-white/60 bg-white/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"}`}>
                  <span className="font-semibold">Card · Google Pay · Apple Pay</span>
                  <span className="block text-xs text-neutral-500">Any card, or Google Pay / Apple Pay; secure checkout, charged in {currency}</span>
                </button>
                {waychitOn && (
                  <button type="button" onClick={() => { setMethod("waychit"); setError(""); }}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${method === "waychit" ? "border-white/60 bg-white/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"}`}>
                    <span className="font-semibold">Wave · QMoney · Afrimoney — instant</span>
                    <span className="block text-xs text-neutral-500">Pay on Waychit&apos;s secure page; confirmed automatically. Adds {(waychit?.fee_bps ?? 300) / 100}% processing.</span>
                  </button>
                )}
                {walletOptions.map((m) => (
                  <button key={m} type="button" onClick={() => { setMethod(m); setError(""); }}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${method === m ? "border-white/60 bg-white/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"}`}>
                    <span className="font-semibold">{METHOD_LABEL[m]}</span>
                    <span className="block text-xs text-neutral-500">Send to {wallet.numbers[m]}, then enter your transaction reference</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
          {open && promoterCodeBps > 0 && (
            <div className="mx-auto mt-3 flex max-w-6xl flex-wrap items-center gap-2 border-t border-white/10 pt-3">
              <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder={viewerIsPromoter ? "Discount coupon (optional)" : "Promoter or discount code"} autoCapitalize="characters"
                className="w-56 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-dm-mono text-sm text-neutral-100 placeholder:text-neutral-600 outline-none" />
              <span className="text-xs text-neutral-500">
                {viewerIsPromoter
                  ? `Your promoter discount (${promoterCodeBps / 100}%) is applied. A discount coupon stacks on top, priced at checkout.`
                  : `A promoter's code saves you ${promoterCodeBps / 100}% on your items; a discount coupon is priced at checkout.`}
              </span>
            </div>
          )}
          {open && <div className="mx-auto mt-1 flex max-w-6xl justify-center"><IntlPaymentNote /></div>}
        </div>
      )}
    </>
  );
}
