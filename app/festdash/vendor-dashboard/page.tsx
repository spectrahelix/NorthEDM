"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

type Order = {
  id: string;
  customer_name: string;
  campground_zone: string;
  campsite_notes: string;
  campsite_photo_url: string | null;
  delivery_window: string;
  items: { name: string; qty: number; price: number }[];
  total_cents: number;
  status: "pending" | "accepted" | "in_transit" | "delivered" | "declined";
  created_at: string;
};

const STATUS_LABELS: Record<Order["status"], string> = {
  pending: "New Order",
  accepted: "Accepted",
  in_transit: "Out for Delivery",
  delivered: "Delivered",
  declined: "Declined",
};

const STATUS_COLORS: Record<Order["status"], string> = {
  pending: "bg-orange-500/20 text-orange-400",
  accepted: "bg-blue-500/20 text-blue-400",
  in_transit: "bg-purple-500/20 text-purple-400",
  delivered: "bg-green-500/20 text-green-400",
  declined: "bg-neutral-500/20 text-neutral-500",
};

export default function VendorDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; onboarded: boolean } | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const prevPendingCount = useRef(0);
  const supabase = createClient();

  useEffect(() => {
    fetch("/api/festdash/stripe/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setStripeStatus({ connected: !!d.connected, onboarded: !!d.onboarded }); })
      .catch(() => {});
  }, []);

  async function connectStripe() {
    setConnectingStripe(true);
    const res = await fetch("/api/festdash/stripe/connect", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) {
      window.location.href = j.url;
    } else {
      alert(j.error ?? "Couldn't start Stripe setup.");
      setConnectingStripe(false);
    }
  }

  const loadOrders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNotEnrolled(true); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("vendor_id")
      .eq("id", user.id)
      .single();

    if (!profile?.vendor_id) { setNotEnrolled(true); setLoading(false); return; }

    const { data } = await supabase
      .from("festdash_orders")
      .select("*")
      .eq("vendor_id", profile.vendor_id)
      .order("created_at", { ascending: false });

    const freshOrders = (data as Order[]) ?? [];
    setOrders(freshOrders);
    setLoading(false);

    const pendingCount = freshOrders.filter((o) => o.status === "pending").length;
    if (pendingCount > prevPendingCount.current) {
      setNewOrderAlert(true);
      setTimeout(() => setNewOrderAlert(false), 4000);
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } catch {}
    }
    prevPendingCount.current = pendingCount;
  }, [supabase]);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel("festdash_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "festdash_orders" }, () => {
        loadOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadOrders, supabase]);

  async function updateStatus(orderId: string, status: Order["status"]) {
    let code: string | undefined;
    if (status === "delivered") {
      const entered = window.prompt(
        "Enter the customer's 4-digit confirmation code (last 4 of their phone):"
      );
      if (!entered) return;
      code = entered;
    }
    setUpdating(orderId);
    const res = await fetch(`/api/festdash/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, code }),
    });
    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      if (selected?.id === orderId) setSelected((s) => s ? { ...s, status } : s);
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Update failed.");
    }
    setUpdating(null);
  }

  const pending = orders.filter((o) => o.status === "pending");
  const active = orders.filter((o) => o.status === "accepted" || o.status === "in_transit");
  const done = orders.filter((o) => o.status === "delivered" || o.status === "declined");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="font-dm-mono text-sm text-neutral-500">Loading orders…</div>
      </div>
    );
  }

  if (notEnrolled) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🎪</div>
          <h2 className="mb-2 font-bebas text-3xl tracking-wide text-white">Not Yet Enrolled</h2>
          <p className="mb-6 text-neutral-500">Your account isn&apos;t linked to a FestDash vendor profile. Apply to join the network or contact an admin to be directly enrolled.</p>
          <a href="/festdash/vendor-signup" className="inline-block rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-400">
            Apply to FestDash
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 lg:p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-bebas text-3xl tracking-wide text-white">
              Fest<span className="text-orange-400">Dash</span> Orders
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-dm-mono text-xs text-neutral-500">Vendor Dashboard</p>
              <a href="/festdash/driver" className="font-dm-mono text-xs text-purple-400 hover:text-purple-300">Runner View →</a>
              <a href="/vendor" className="font-dm-mono text-xs text-neutral-500 hover:text-neutral-300">Manage Products →</a>
              <a href="/festdash/referrals" className="font-dm-mono text-xs text-[#39FF14] hover:text-[#39FF14]/80">Referral Codes →</a>
              <a href="/festdash/commission-codes" className="font-dm-mono text-xs text-orange-400 hover:text-orange-300">Commission Codes →</a>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="font-dm-mono text-xs text-green-400">Live</span>
          </div>
        </div>

        {/* Stripe payouts status */}
        {stripeStatus && !stripeStatus.onboarded && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-orange-500/30 bg-orange-950/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-orange-300">💳 Set up payouts</p>
              <p className="text-sm text-neutral-400">Connect a Stripe account to receive your earnings — funds are held in escrow until each order is delivered, then paid out (minus a 5% FestDash fee).</p>
            </div>
            <button
              onClick={connectStripe}
              disabled={connectingStripe}
              className="shrink-0 rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
            >
              {connectingStripe ? "Starting…" : stripeStatus.connected ? "Finish setup" : "Set up payouts"}
            </button>
          </div>
        )}
        {stripeStatus?.onboarded && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 px-4 py-2 text-sm text-green-400">
            <span>✓</span> Payouts active — earnings transfer to your Stripe account on delivery.
          </div>
        )}

        {/* New order alert banner */}
        {newOrderAlert && (
          <div className="mb-4 animate-pulse rounded-2xl border border-orange-500/50 bg-orange-500/10 px-5 py-3 text-center font-semibold text-orange-300">
            🔔 New order incoming!
          </div>
        )}

        {/* Pending — most prominent */}
        {pending.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-orange-400">
              New Orders ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onView={() => setSelected(order)}
                  onAccept={() => updateStatus(order.id, "accepted")}
                  onDecline={() => updateStatus(order.id, "declined")}
                  updating={updating === order.id}
                  highlight
                />
              ))}
            </div>
          </div>
        )}

        {/* Active */}
        {active.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-blue-400">
              In Progress ({active.length})
            </h2>
            <div className="space-y-3">
              {active.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onView={() => setSelected(order)}
                  onMarkDelivered={() => updateStatus(order.id, "delivered")}
                  updating={updating === order.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {pending.length === 0 && active.length === 0 && (
          <div className="rounded-2xl border border-white/8 bg-white/3 py-16 text-center">
            <div className="mb-3 text-4xl">🏕️</div>
            <p className="text-neutral-500">No active orders right now.</p>
            <p className="text-sm text-neutral-600">New orders will appear here instantly.</p>
          </div>
        )}

        {/* Completed */}
        {done.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
              Completed ({done.length})
            </h2>
            <div className="space-y-2">
              {done.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-white/3 px-4 py-3 transition hover:bg-white/5"
                >
                  <div>
                    <span className="text-sm text-neutral-400">{order.customer_name}</span>
                    <span className="ml-2 text-xs text-neutral-600">{order.campground_zone}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">{selected.customer_name}</h3>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-white/5 px-4 py-3">
                <p className="font-dm-mono text-xs text-neutral-500 mb-1">LOCATION</p>
                <p className="text-white">{selected.campground_zone}</p>
                {selected.campsite_notes && (
                  <p className="mt-1 text-neutral-400">{selected.campsite_notes}</p>
                )}
              </div>

              {selected.campsite_photo_url && (
                <img
                  src={selected.campsite_photo_url}
                  alt="Campsite"
                  className="w-full rounded-xl object-cover"
                  style={{ maxHeight: 200 }}
                />
              )}

              <div className="rounded-xl bg-white/5 px-4 py-3">
                <p className="font-dm-mono text-xs text-neutral-500 mb-1">DELIVERY WINDOW</p>
                <p className="text-white">{selected.delivery_window}</p>
              </div>

              <div className="rounded-xl bg-white/5 px-4 py-3">
                <p className="font-dm-mono text-xs text-neutral-500 mb-2">ITEMS</p>
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-white">{item.qty}× {item.name}</span>
                    <span className="text-neutral-400">${(item.price / 100).toFixed(2)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-orange-400">${(selected.total_cents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className={`rounded-full px-3 py-1 text-center font-dm-mono text-xs ${STATUS_COLORS[selected.status]}`}>
                {STATUS_LABELS[selected.status]}
              </div>

              {selected.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { updateStatus(selected.id, "accepted"); setSelected(null); }}
                    className="flex-1 rounded-xl bg-orange-500 py-3 font-semibold text-white"
                  >
                    Accept Order
                  </button>
                  <button
                    onClick={() => { updateStatus(selected.id, "declined"); setSelected(null); }}
                    className="flex-1 rounded-xl border border-white/10 py-3 text-neutral-400"
                  >
                    Decline
                  </button>
                </div>
              )}
              {(selected.status === "accepted" || selected.status === "in_transit") && (
                <button
                  onClick={() => { updateStatus(selected.id, "delivered"); setSelected(null); }}
                  className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white"
                >
                  Mark Delivered
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function OrderCard({
  order,
  onView,
  onAccept,
  onDecline,
  onMarkDelivered,
  updating,
  highlight = false,
}: {
  order: Order;
  onView: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onMarkDelivered?: () => void;
  updating: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        highlight
          ? "border-orange-500/40 bg-orange-950/20"
          : "border-white/8 bg-white/3"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white">{order.customer_name}</p>
          <p className="text-sm text-neutral-400">{order.campground_zone}</p>
          <p className="text-xs text-neutral-500">Window: {order.delivery_window}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          <span className="text-sm font-semibold text-orange-400">
            ${(order.total_cents / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mb-3 text-sm text-neutral-400">
        {order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onView}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-400 transition hover:bg-white/5"
        >
          View Details
        </button>
        {onAccept && (
          <button
            onClick={onAccept}
            disabled={updating}
            className="flex-1 rounded-xl bg-orange-500 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            {updating ? "…" : "Accept"}
          </button>
        )}
        {onDecline && (
          <button
            onClick={onDecline}
            disabled={updating}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-500 transition hover:bg-white/5 disabled:opacity-50"
          >
            Decline
          </button>
        )}
        {onMarkDelivered && (
          <button
            onClick={onMarkDelivered}
            disabled={updating}
            className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
          >
            {updating ? "…" : "Mark Delivered"}
          </button>
        )}
      </div>
    </div>
  );
}
