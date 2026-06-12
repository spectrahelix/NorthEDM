"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

type Order = {
  id: string;
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

export default function DriverPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const loadOrders = useCallback(async (vId: number) => {
    const { data } = await supabase
      .from("festdash_orders")
      .select("*")
      .eq("vendor_id", vId)
      .in("status", ["accepted", "in_transit"])
      .order("created_at", { ascending: true });
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUnauthorized(true); setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles").select("vendor_id").eq("id", user.id).single();
      if (!profile?.vendor_id) { setUnauthorized(true); setLoading(false); return; }

      setVendorId(profile.vendor_id);
      await loadOrders(profile.vendor_id);

      const channel = supabase
        .channel("driver_orders")
        .on("postgres_changes", { event: "*", schema: "public", table: "festdash_orders" }, () => {
          loadOrders(profile.vendor_id);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    })();
  }, [supabase, loadOrders]);

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId);
    const res = await fetch(`/api/festdash/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      if (status === "delivered") {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        if (selected?.id === orderId) setSelected(null);
      } else {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: status as Order["status"] } : o));
        if (selected?.id === orderId) setSelected((s) => s ? { ...s, status: status as Order["status"] } : s);
      }
    }
    setUpdating(null);
  }

  if (unauthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6">
        <div className="text-center">
          <p className="text-neutral-400">Driver access requires a linked vendor account.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="font-dm-mono text-sm text-neutral-500">Loading deliveries…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-4">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-bebas text-3xl tracking-wide text-white">
              Driver <span className="text-orange-400">View</span>
            </h1>
            <div className="flex items-center gap-3">
              <p className="font-dm-mono text-xs text-neutral-500">Active deliveries</p>
              <a href="/festdash/vendor-dashboard" className="font-dm-mono text-xs text-orange-400 hover:text-orange-300">← Vendor Board</a>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="font-dm-mono text-xs text-green-400">Live</span>
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-white/8 py-16 text-center">
            <div className="mb-3 text-4xl">🏕️</div>
            <p className="text-neutral-500">No active deliveries.</p>
            <p className="text-sm text-neutral-600">Accepted orders will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`rounded-2xl border p-5 ${
                  order.status === "in_transit"
                    ? "border-purple-500/30 bg-purple-950/20"
                    : "border-white/10 bg-white/3"
                }`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white">{order.customer_name}</p>
                    <p className="text-sm text-orange-400">{order.campground_zone}</p>
                    <p className="text-xs text-neutral-500">{order.event_name}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${
                    order.status === "in_transit" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                  }`}>
                    {order.status === "in_transit" ? "En Route" : "Ready to Pick Up"}
                  </span>
                </div>

                {/* Items */}
                <div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
                  {order.items.map((i, idx) => (
                    <span key={idx} className="text-neutral-300">{idx > 0 ? " · " : ""}{i.qty}× {i.name}</span>
                  ))}
                </div>

                <p className="mb-3 text-xs text-neutral-500">Window: {order.delivery_window}</p>

                {/* Campsite photo */}
                {order.campsite_photo_url && (
                  <img
                    src={order.campsite_photo_url}
                    alt="Campsite"
                    className="mb-3 w-full rounded-xl object-cover"
                    style={{ maxHeight: 180 }}
                  />
                )}

                {order.campsite_notes && (
                  <div className="mb-3 rounded-xl border border-yellow-500/20 bg-yellow-950/20 px-3 py-2 text-xs text-yellow-300">
                    📍 {order.campsite_notes}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {order.status === "accepted" && (
                    <button
                      onClick={() => updateStatus(order.id, "in_transit")}
                      disabled={updating === order.id}
                      className="flex-1 rounded-xl bg-purple-600 py-2.5 font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                    >
                      {updating === order.id ? "…" : "🏃 I'm On My Way"}
                    </button>
                  )}
                  {order.status === "in_transit" && (
                    <button
                      onClick={() => updateStatus(order.id, "delivered")}
                      disabled={updating === order.id}
                      className="flex-1 rounded-xl bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      {updating === order.id ? "…" : "✅ Mark Delivered"}
                    </button>
                  )}
                  <button
                    onClick={() => setSelected(order)}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-400 hover:bg-white/5"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">{selected.customer_name}</h3>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="font-dm-mono text-xs text-neutral-500 mb-1">LOCATION</p>
                <p className="text-white">{selected.campground_zone}</p>
                {selected.campsite_notes && <p className="mt-1 text-neutral-400">{selected.campsite_notes}</p>}
              </div>
              {selected.campsite_photo_url && (
                <img src={selected.campsite_photo_url} alt="Campsite" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
              )}
              <div className="rounded-xl bg-white/5 p-3">
                <p className="font-dm-mono text-xs text-neutral-500 mb-1">WINDOW</p>
                <p className="text-white">{selected.delivery_window}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="font-dm-mono text-xs text-neutral-500 mb-2">ITEMS</p>
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-white">{item.qty}× {item.name}</span>
                    <span className="text-neutral-400">${(item.price / 100).toFixed(2)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-semibold">
                  <span className="text-white">Collect</span>
                  <span className="text-orange-400">${(selected.total_cents / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
