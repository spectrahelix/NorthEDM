"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Order = {
  id: string;
  vendor_id: number;
  event_name: string;
  campground_zone: string;
  delivery_window: string;
  items: { name: string; qty: number; price: number }[];
  total_cents: number;
  status: "pending" | "accepted" | "in_transit" | "delivered" | "declined";
  created_at: string;
};

const STATUS_LABELS: Record<Order["status"], string> = {
  pending:    "Waiting on Vendor",
  accepted:   "Accepted",
  in_transit: "On the Way 🏃",
  delivered:  "Delivered ✅",
  declined:   "Declined",
};

const STATUS_COLORS: Record<Order["status"], string> = {
  pending:    "bg-yellow-500/20 text-yellow-400",
  accepted:   "bg-blue-500/20 text-blue-400",
  in_transit: "bg-purple-500/20 text-purple-400",
  delivered:  "bg-green-500/20 text-green-400",
  declined:   "bg-neutral-500/20 text-neutral-500",
};

export default function MyOrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthed(false); setLoading(false); return; }

      const res = await fetch("/api/festdash/orders");
      const json = await res.json();
      setOrders(json.orders ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6">
        <div className="text-center">
          <p className="mb-4 text-neutral-400">Sign in to view your orders.</p>
          <Link href="/login" className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-400">
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const active = orders.filter((o) => o.status !== "delivered" && o.status !== "declined");
  const past   = orders.filter((o) => o.status === "delivered" || o.status === "declined");

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16">
      <div className="mx-auto max-w-lg">
        <Link href="/festdash" className="mb-6 block font-dm-mono text-xs text-neutral-500 hover:text-white">
          ← FestDash
        </Link>
        <h1 className="mb-2 font-bebas text-5xl tracking-wide text-white">
          My <span className="text-orange-400">Orders</span>
        </h1>

        {loading ? (
          <div className="py-16 text-center font-dm-mono text-sm text-neutral-500">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-white/8 py-16 text-center">
            <div className="mb-3 text-4xl">🎪</div>
            <p className="text-neutral-500">No orders yet.</p>
            <Link href="/festdash/order" className="mt-4 inline-block rounded-2xl bg-orange-500 px-6 py-2.5 font-semibold text-white hover:bg-orange-400">
              Place Your First Order
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-orange-400">Active ({active.length})</h2>
                <div className="space-y-3">
                  {active.map((o) => <OrderRow key={o.id} order={o} />)}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">Past Orders</h2>
                <div className="space-y-3">
                  {past.map((o) => <OrderRow key={o.id} order={o} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <Link
      href={`/festdash/track/${order.id}`}
      className="block rounded-2xl border border-white/8 bg-white/3 p-4 transition hover:border-orange-500/30 hover:bg-orange-950/10"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{order.event_name}</p>
          <p className="text-sm text-neutral-500">{order.campground_zone} · {order.delivery_window}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          <span className="text-sm font-semibold text-orange-400">${(order.total_cents / 100).toFixed(2)}</span>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        {order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
      </p>
    </Link>
  );
}
