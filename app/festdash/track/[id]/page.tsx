"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { use } from "react";

type Order = {
  id: string;
  vendor_id: number;
  customer_name: string;
  event_name: string;
  campground_zone: string;
  campsite_notes: string;
  campsite_photo_url: string | null;
  delivery_window: string;
  items: { name: string; qty: number; price: number }[];
  total_cents: number;
  status: "pending" | "accepted" | "in_transit" | "delivered" | "declined";
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

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

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

  const currentStep = STATUS_INDEX[order.status] ?? 0;
  const isDeclined = order.status === "declined";

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
            <p className="text-red-400">The vendor declined this order.</p>
            <Link href="/festdash/order" className="mt-4 inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-400">
              Place a New Order
            </Link>
          </div>
        ) : (
          <>
            {/* Progress tracker */}
            <div className="mb-8 space-y-3">
              {STEPS.map((s, i) => {
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

            {/* Order summary */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
              <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Your Order</p>
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between py-1 text-sm">
                  <span className="text-white">{item.qty}× {item.name}</span>
                  <span className="text-neutral-400">${(item.price / 100).toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-semibold">
                <span className="text-white">Total</span>
                <span className="text-orange-400">${(order.total_cents / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/3 p-5 text-sm">
              <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Delivery Info</p>
              <p className="text-white">{order.campground_zone}</p>
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
