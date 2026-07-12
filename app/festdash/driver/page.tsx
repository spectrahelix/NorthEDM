"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { BackBar } from "@/app/components/BackBar";

type Order = {
  id: string;
  customer_name: string;
  event_name: string;
  campground_zone: string;
  campsite_notes: string;
  campsite_photo_url: string | null;
  car_photo_url: string | null;
  license_plate: string | null;
  delivery_window: string;
  items: { name: string; qty: number; price: number }[];
  total_cents: number;
  status: "pending" | "accepted" | "in_transit" | "delivered" | "declined";
  driver_id: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  created_at: string;
};

type Driver = { id: string; display_name: string; phone: string | null; vehicle: string | null; is_active: boolean };

export default function DriverPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [needAuth, setNeedAuth] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);

  const [available, setAvailable] = useState<Order[]>([]);
  const [mine, setMine] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Registration form
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState("");

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/festdash/driver/orders");
    if (res.ok) {
      const j = await res.json();
      setAvailable(j.available ?? []);
      setMine(j.mine ?? []);
    }
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setNeedAuth(true); setLoading(false); return; }
      if (user.email) setDisplayName(user.email.split("@")[0]);

      const res = await fetch("/api/festdash/driver");
      const j = await res.json();
      setDriver(j.driver ?? null);
      if (j.driver) await loadOrders();
      setLoading(false);

      channel = supabase
        .channel("driver_orders")
        .on("postgres_changes", { event: "*", schema: "public", table: "festdash_orders" }, () => {
          loadOrders();
        })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [supabase, loadOrders]);

  // Share live GPS while any delivery is in transit
  const transitIds = mine.filter((o) => o.status === "in_transit").map((o) => o.id).join(",");
  useEffect(() => {
    const ids = transitIds ? transitIds.split(",") : [];
    if (ids.length === 0 || typeof navigator === "undefined" || !navigator.geolocation) return;
    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent < 12000) return; // throttle to ~12s
        lastSent = now;
        const { latitude, longitude } = pos.coords;
        ids.forEach((oid) => {
          fetch(`/api/festdash/orders/${oid}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          }).catch(() => {});
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [transitIds]);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegistering(true);
    const res = await fetch("/api/festdash/driver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, phone, vehicle }),
    });
    const j = await res.json();
    if (res.ok) {
      setDriver(j.driver);
      await loadOrders();
    } else {
      setRegError(j.error ?? "Registration failed.");
    }
    setRegistering(false);
  }

  async function claim(orderId: string) {
    setUpdating(orderId);
    const res = await fetch(`/api/festdash/orders/${orderId}/claim`, { method: "POST" });
    if (res.ok) {
      await loadOrders();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Claim failed.");
      await loadOrders();
    }
    setUpdating(null);
  }

  async function updateStatus(orderId: string, status: string) {
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
      await loadOrders();
      if (selected?.id === orderId) setSelected(null);
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Update failed.");
    }
    setUpdating(null);
  }

  // ── Gates ────────────────────────────────────────────────────────
  if (needAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🏃</div>
          <h2 className="mb-2 font-bebas text-3xl tracking-wide text-white">Sign in to Run</h2>
          <p className="mb-6 text-neutral-500">You need a NorthEDM account to deliver with FestDash.</p>
          <a href={`/login?next=${encodeURIComponent("/festdash/driver")}`} className="inline-block rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-400">
            Sign In
          </a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-dm-mono text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  // ── Driver registration ──────────────────────────────────────────
  if (!driver) {
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-md">
          <div className="mb-2 text-4xl">🏃</div>
          <h1 className="mb-2 font-bebas text-4xl tracking-wide text-white">Become a <span className="text-orange-400">Runner</span></h1>
          <p className="mb-8 text-neutral-500">Register once, then claim deliveries at any festival.</p>

          <form onSubmit={register} className="space-y-5">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Name *</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="How customers will see you"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="(570) 555-1234"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Vehicle</label>
              <input
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="e.g. Red golf cart, blue bike, on foot"
              />
            </div>
            {regError && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{regError}</p>}
            <button
              type="submit"
              disabled={registering || !displayName.trim()}
              className="w-full rounded-2xl bg-orange-500 py-3.5 font-semibold text-white transition hover:bg-orange-400 disabled:opacity-40"
            >
              {registering ? "Registering…" : "Register as Runner 🏃"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Driver console ───────────────────────────────────────────────
  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto max-w-lg">
        <BackBar crumbs={[{ label: "FestDash", href: "/festdash" }]} fallback="/festdash" />
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-bebas text-3xl tracking-wide text-white">
              Runner <span className="text-orange-400">View</span>
            </h1>
            <p className="font-dm-mono text-xs text-neutral-500">{driver.display_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadOrders} className="rounded-full border border-white/10 px-3 py-1.5 font-dm-mono text-xs text-neutral-400 hover:bg-white/5">
              ↻ Refresh
            </button>
            <span className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              <span className="font-dm-mono text-xs text-green-400">Live</span>
            </span>
          </div>
        </div>

        {transitIds && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            Sharing your live location with customers while en route.
          </div>
        )}

        {/* My deliveries */}
        <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">My Deliveries</h2>
        {mine.length === 0 ? (
          <div className="mb-8 rounded-2xl border border-white/8 py-8 text-center">
            <p className="text-sm text-neutral-500">Nothing claimed yet — grab one below.</p>
          </div>
        ) : (
          <div className="mb-8 space-y-4">
            {mine.map((order) => (
              <OrderCard key={order.id} order={order} onDetails={() => setSelected(order)}>
                <a
                  href={navUrl(order)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center rounded-xl border border-white/15 px-4 py-2.5 text-sm text-neutral-300 hover:bg-white/5"
                >
                  🧭 Navigate
                </a>
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
              </OrderCard>
            ))}
          </div>
        )}

        {/* Available pool */}
        <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Available to Claim</h2>
        {available.length === 0 ? (
          <div className="rounded-2xl border border-white/8 py-16 text-center">
            <div className="mb-3 text-4xl">🏕️</div>
            <p className="text-neutral-500">No deliveries available right now.</p>
            <p className="text-sm text-neutral-600">Accepted orders waiting for a runner show up here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {available.map((order) => (
              <OrderCard key={order.id} order={order} onDetails={() => setSelected(order)}>
                <button
                  onClick={() => claim(order.id)}
                  disabled={updating === order.id}
                  className="flex-1 rounded-xl bg-orange-500 py-2.5 font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
                >
                  {updating === order.id ? "…" : "🙋 Claim Delivery"}
                </button>
              </OrderCard>
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
              {selected.license_plate && (
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="font-dm-mono text-xs text-neutral-500 mb-1">LICENSE PLATE</p>
                  <p className="uppercase text-white">{selected.license_plate}</p>
                </div>
              )}
              {(selected.campsite_photo_url || selected.car_photo_url) && (
                <div className="flex gap-2">
                  {selected.campsite_photo_url && <img src={selected.campsite_photo_url} alt="Campsite" className="w-1/2 rounded-xl object-cover" style={{ maxHeight: 160 }} />}
                  {selected.car_photo_url && <img src={selected.car_photo_url} alt="Car" className="w-1/2 rounded-xl object-cover" style={{ maxHeight: 160 }} />}
                </div>
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
                  <span className="text-white">Order total</span>
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

function navUrl(o: Order) {
  if (o.customer_lat != null && o.customer_lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${o.customer_lat},${o.customer_lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.campground_zone} ${o.event_name}`)}`;
}

function OrderCard({ order, onDetails, children }: { order: Order; onDetails: () => void; children?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-5 ${order.status === "in_transit" ? "border-purple-500/30 bg-purple-950/20" : "border-white/10 bg-white/3"}`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="font-semibold text-white">{order.customer_name}</p>
          <p className="text-sm text-orange-400">{order.campground_zone}</p>
          <p className="text-xs text-neutral-500">{order.event_name}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${
          order.status === "in_transit" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
        }`}>
          {order.status === "in_transit" ? "En Route" : order.driver_id ? "Claimed" : "Available"}
        </span>
      </div>

      <div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
        {order.items.map((i, idx) => (
          <span key={idx} className="text-neutral-300">{idx > 0 ? " · " : ""}{i.qty}× {i.name}</span>
        ))}
      </div>

      <p className="mb-3 text-xs text-neutral-500">Window: {order.delivery_window}</p>

      {order.campsite_photo_url && (
        <img src={order.campsite_photo_url} alt="Campsite" className="mb-3 w-full rounded-xl object-cover" style={{ maxHeight: 180 }} />
      )}

      {order.campsite_notes && (
        <div className="mb-3 rounded-xl border border-yellow-500/20 bg-yellow-950/20 px-3 py-2 text-xs text-yellow-300">
          📍 {order.campsite_notes}
        </div>
      )}

      <div className="flex gap-2">
        {children}
        <button onClick={onDetails} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-400 hover:bg-white/5">
          Details
        </button>
      </div>
    </div>
  );
}
