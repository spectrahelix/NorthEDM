"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { use } from "react";

import LiveMap from "@/app/components/festdash/LiveMap";
import { formatMoney } from "@/utils/money";
import { METHOD_LABEL, orderRef, isWalletMethod } from "@/utils/gambiaPay";
import { PaymentTimingNote } from "@/app/components/festdash/PaymentTimingNote";
import { WalletDispute } from "@/app/components/festdash/WalletDispute";
type Order = {
  id: string;
  vendor_id: number;
  customer_name: string;
  event_name: string;
  campground_zone: string;
  campsite_notes: string;
  campsite_photo_url: string | null;
  delivery_window: string;
  fulfillment?: string;
  items: { name: string; qty: number; price: number }[];
  total_cents: number;
  status: "awaiting_payment" | "awaiting_confirmation" | "pending" | "accepted" | "in_transit" | "delivered" | "declined";
  confirmation_code: string | null;
  payment_method: string;
  payment_to: string | null;
  payment_ref: string | null;
  payment_ref_at?: string | null;
  payment_disputed_at?: string | null;
  payment_status: string;
  currency: string;
  driver_lat: number | null;
  driver_lng: number | null;
  location_updated_at: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  created_at: string;
};

const STEPS = [
  { key: "pending",    label: "Order Placed",      icon: "✅" },
  { key: "accepted",   label: "Vendor Accepted",   icon: "🛒" },
  { key: "in_transit", label: "On the Way",         icon: "🏃" },
  { key: "delivered",  label: "Delivered!",         icon: "🏕️" },
];

const STATUS_INDEX: Record<string, number> = {
  pending: 0, accepted: 1, in_transit: 2, delivered: 3,
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(mi: number) {
  if (mi < 0.19) return `${Math.round((mi * 5280) / 10) * 10} ft`;
  return `${mi.toFixed(1)} mi`;
}

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refInput, setRefInput] = useState("");
  const [refSaving, setRefSaving] = useState(false);
  const [refMsg, setRefMsg] = useState("");

  const loadOrder = useCallback(async () => {
    const { data } = await supabase
      .from("festdash_orders")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setOrder(data as Order);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadOrder();
    const channel = supabase
      .channel(`order_${id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "festdash_orders",
        filter: `id=eq.${id}`,
      }, (payload) => {
        setOrder((prev) => prev ? { ...prev, ...(payload.new as Partial<Order>) } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadOrder, supabase]);

  // Fresh back from Stripe checkout: the order sits in "awaiting_payment" until
  // the card hold is confirmed. Nudge the confirm fallback once (the webhook is
  // the primary path); realtime picks up the promotion to "pending".
  const confirmTried = useRef(false);
  useEffect(() => {
    if (order?.status === "awaiting_payment" && !confirmTried.current) {
      confirmTried.current = true;
      fetch("/api/festdash/stripe/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      })
        .then(() => loadOrder())
        .catch(() => {});
    }
  }, [order?.status, id, loadOrder]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-dm-mono text-sm text-neutral-500">Loading order…</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400">Order not found.</p>
          <Link href="/festdash" className="mt-4 block text-orange-400 hover:underline">Back to FestDash</Link>
        </div>
      </main>
    );
  }

  // A wallet order (Wave / QMoney / Afrimoney): show where to pay and take the
  // customer's transaction reference. The purse keeper confirms from their
  // wallet; realtime flips this page to the tracker when they do.
  if (order.status === "awaiting_confirmation") {
    const methodKey = isWalletMethod(order.payment_method) ? order.payment_method : "wave";
    const method = METHOD_LABEL[methodKey];
    const ref = orderRef(order.id);
    const saveRef = async () => {
      setRefSaving(true);
      setRefMsg("");
      const res = await fetch(`/api/festdash/orders/${order.id}/payment-ref`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: refInput.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      setRefSaving(false);
      if (res.ok) { setRefInput(""); await loadOrder(); } else setRefMsg(j.error ?? "Couldn't save that — try again.");
    };
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-4xl">📲</div>
          <h1 className="mb-2 font-bebas text-3xl tracking-wide text-white">
            Pay {formatMoney(order.total_cents, order.currency)} by {method}
          </h1>
          <p className="mb-6 text-neutral-400">
            Send it from your {method} app to the shop&apos;s purse keeper and put the reference in the transfer note so it can be matched.
          </p>
          <div className="mb-4 rounded-2xl border border-orange-500/20 bg-orange-950/20 p-5">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-400">Send to</p>
            <p className="mt-1 text-2xl font-semibold text-white">{order.payment_to ?? "—"}</p>
            <p className="mt-3 font-dm-mono text-xs uppercase tracking-widest text-orange-400">Reference</p>
            <p className="mt-1 text-2xl font-semibold text-white">{ref}</p>
          </div>
          <PaymentTimingNote method={methodKey} className="mb-4" />
          {order.payment_ref ? (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
              ✓ Reference <span className="font-dm-mono">{order.payment_ref}</span> received. The purse keeper confirms it from their wallet and this page updates on its own.
            </div>
          ) : null}
          {order.payment_ref ? (
            <WalletDispute kind="festdash" id={order.id} refAt={order.payment_ref_at ?? null} alreadyReported={!!order.payment_disputed_at} />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Your {method} transaction reference</label>
              <input
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="the transaction ID shown in the app"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
              />
              <button
                onClick={saveRef}
                disabled={refSaving || !refInput.trim()}
                className="mt-3 w-full rounded-2xl bg-orange-500 py-3 font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
              >
                {refSaving ? "Saving…" : "I've paid — submit reference"}
              </button>
              {refMsg && <p className="mt-2 text-xs text-red-400">{refMsg}</p>}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Payment still being authorized (just back from Stripe). Show a calm
  // "confirming" state rather than the order tracker until it's escrowed.
  if (order.status === "awaiting_payment") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🔒</div>
          <h1 className="mb-2 font-bebas text-3xl tracking-wide text-white">Confirming your payment…</h1>
          <p className="text-neutral-500">
            Your card is being authorized and held in escrow. This page updates automatically —
            it usually only takes a moment.
          </p>
          <span className="mt-6 inline-flex h-2 w-2 animate-pulse rounded-full bg-orange-400" />
        </div>
      </main>
    );
  }

  const currentStep = STATUS_INDEX[order.status] ?? 0;
  const isDeclined = order.status === "declined";

  // Live runner map (Mapbox GL via <LiveMap>; renders only when a token is set)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const hasRunnerLoc = order.driver_lat != null && order.driver_lng != null;
  const runnerPoint = hasRunnerLoc ? { lat: order.driver_lat!, lng: order.driver_lng! } : null;
  const sitePoint =
    order.customer_lat != null && order.customer_lng != null
      ? { lat: order.customer_lat, lng: order.customer_lng }
      : null;

  // Live runner -> campsite distance + rough ETA (~4 mph on-site pace)
  const hasSite = order.customer_lat != null && order.customer_lng != null;
  const distMi = hasRunnerLoc && hasSite
    ? haversineMi(order.driver_lat!, order.driver_lng!, order.customer_lat!, order.customer_lng!)
    : null;
  const etaMin = distMi != null ? Math.max(1, Math.round((distMi / 4) * 60)) : null;

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-md">
        <Link href="/festdash" className="mb-6 block font-dm-mono text-xs text-neutral-500 hover:text-white">
          ← FestDash
        </Link>

        <h1 className="mb-1 font-bebas text-4xl tracking-wide text-white">
          {order.status === "delivered" ? "Delivered! 🎉" : isDeclined ? "Order Declined" : "Tracking Order"}
        </h1>
        <p className="mb-8 font-dm-mono text-xs text-neutral-500">Order #{id.slice(0, 8).toUpperCase()}</p>

        {isDeclined ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-center">
            <p className="text-red-400">{order.payment_status === "rejected" ? "The payment for this order was marked as not received." : "The vendor declined this order."}</p>
            {order.payment_status === "rejected" && order.payment_ref && (
              <div className="text-left"><WalletDispute kind="festdash" id={order.id} refAt={order.payment_ref_at ?? null} rejected alreadyReported={!!order.payment_disputed_at} /></div>
            )}
            <Link href="/festdash/order" className="mt-4 inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-400">
              Place a New Order
            </Link>
          </div>
        ) : (
          <>
            {/* Delivery code — the customer reads this to their runner to
                confirm delivery. Hidden once delivered. */}
            {order.status !== "delivered" && order.confirmation_code && (
              <div className="mb-8 rounded-2xl border border-green-500/25 bg-green-950/20 p-5 text-center">
                <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-green-400">
                  Your Delivery Code
                </p>
                <p className="my-2 font-dm-mono text-4xl font-bold tracking-[0.4em] text-white">
                  {order.confirmation_code}
                </p>
                <p className="text-xs text-neutral-400">
                  Give this to your runner at drop-off to confirm delivery.
                </p>
              </div>
            )}

            {/* Progress tracker */}
            <div className="mb-8 space-y-3">
              {(order.fulfillment === "pickup" ? STEPS.map((s) => s.key === "in_transit" ? { ...s, label: "Ready for pickup", icon: "🛍️" } : s.key === "delivered" ? { ...s, label: "Collected" } : s) : STEPS).map((s, i) => {
                const done = i <= currentStep;
                const active = i === currentStep;
                return (
                  <div key={s.key} className={`flex items-center gap-4 rounded-xl border p-4 transition ${
                    active ? "border-orange-500/40 bg-orange-950/20"
                    : done ? "border-green-500/20 bg-green-950/10"
                    : "border-white/5 bg-white/2 opacity-40"
                  }`}>
                    <span className="text-2xl">{done ? s.icon : "○"}</span>
                    <div>
                      <p className={`font-semibold ${active ? "text-orange-300" : done ? "text-white" : "text-neutral-600"}`}>{s.label}</p>
                      {active && order.status === "pending" && (
                        <p className="text-xs text-neutral-500">Waiting for vendor to accept</p>
                      )}
                      {active && order.status === "accepted" && (
                        <p className="text-xs text-neutral-500">Your order is being prepared</p>
                      )}
                      {active && order.status === "in_transit" && (
                        <p className="text-xs text-orange-400 animate-pulse">Runner is heading to you now!</p>
                      )}
                    </div>
                    {active && order.status !== "delivered" && (
                      <span className="ml-auto flex h-2 w-2 animate-pulse rounded-full bg-orange-400" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live runner location */}
            {order.status === "in_transit" && (
              <div className="mb-8 overflow-hidden rounded-2xl border border-orange-500/20 bg-white/3">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-400">
                    Live Runner Location
                  </p>
                  {order.location_updated_at && (
                    <span className="font-dm-mono text-[10px] text-neutral-500">
                      updated {timeAgo(order.location_updated_at)}
                    </span>
                  )}
                </div>
                {hasRunnerLoc && mapboxToken ? (
                  <LiveMap token={mapboxToken} runner={runnerPoint} site={sitePoint} height={280} className="" />
                ) : hasRunnerLoc ? (
                  <div className="px-4 pb-4 text-sm text-neutral-400">
                    Runner is near {order.driver_lat!.toFixed(4)}, {order.driver_lng!.toFixed(4)}.
                  </div>
                ) : (
                  <div className="px-4 pb-4 text-sm text-neutral-500">
                    Waiting for your runner to start sharing their location…
                  </div>
                )}
                {distMi != null && (
                  <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 text-sm">
                    <span><span className="font-semibold text-orange-300">{fmtDistance(distMi)}</span><span className="text-neutral-500"> away</span></span>
                    <span className="font-dm-mono text-xs text-neutral-400">~{etaMin} min out</span>
                  </div>
                )}
              </div>
            )}

            {/* Order summary */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
              <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Your Order</p>
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between py-1 text-sm">
                  <span className="text-white">{item.qty}× {item.name}</span>
                  <span className="text-neutral-400">{formatMoney(item.price, order.currency)}</span>
                </div>
              ))}
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-semibold">
                <span className="text-white">Total</span>
                <span className="text-orange-400">{formatMoney(order.total_cents, order.currency)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/3 p-5 text-sm">
              <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{order.fulfillment === "pickup" ? "Pickup" : "Delivery Info"}</p>
              <p className="text-white">{order.fulfillment === "pickup" ? "Collect at the shop — show the last 4 digits of your phone." : order.campground_zone}</p>
              {order.campsite_notes && <p className="mt-1 text-neutral-400">{order.campsite_notes}</p>}
              <p className="mt-1 text-neutral-500">Window: {order.delivery_window}</p>
              {order.campsite_photo_url && (
                <img src={order.campsite_photo_url} alt="Campsite" className="mt-3 w-full rounded-xl object-cover" style={{ maxHeight: 160 }} />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
