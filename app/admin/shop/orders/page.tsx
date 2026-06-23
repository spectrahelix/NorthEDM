"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type OrderItem = { name: string; qty: number; price_cents: number };
type Order = {
  id: string; email: string | null; items: OrderItem[];
  total_cents: number; status: string; ship_name: string | null;
  ship_address: Record<string, string> | null; created_at: string;
};

const STATUS = ["pending", "paid", "fulfilled", "cancelled", "refunded"];
const COLOR: Record<string, string> = {
  pending: "text-yellow-400", paid: "text-[#39FF14]", fulfilled: "text-[#00D4FF]",
  cancelled: "text-neutral-500", refunded: "text-[#FF5C3A]",
};

export default function ShopOrdersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/shop/orders");
    if (res.status === 401 || res.status === 403) { router.push("/"); return; }
    const j = await res.json();
    setOrders(j.orders ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "archon" && p?.role !== "warden") { router.push("/"); return; }
      load();
    });
  }, [supabase, router, load]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const res = await fetch(`/api/admin/shop/orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    setBusy(null);
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center admin-surface font-dm-mono text-sm text-neutral-500">Loading orders…</main>;

  return (
    <main className="min-h-screen text-neutral-100 admin-surface">
      <div className="border-b border-white/10 bg-neutral-950/90">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href="/admin/shop" className="font-dm-mono text-xs text-neutral-600 hover:text-neutral-400">← Store</Link>
            <span className="text-neutral-800">|</span>
            <p className="font-dm-mono text-xs uppercase tracking-widest text-[#39FF14]">Orders</p>
          </div>
          <h1 className="mt-2 font-bebas text-4xl tracking-wide">Store Orders</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-600">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">${(o.total_cents / 100).toFixed(2)}
                      <span className={`ml-3 font-dm-mono text-xs uppercase tracking-widest ${COLOR[o.status] ?? "text-neutral-400"}`}>{o.status}</span>
                    </p>
                    <p className="mt-0.5 font-dm-mono text-xs text-neutral-500">
                      {new Date(o.created_at).toLocaleString()} · {o.email ?? "no email"}
                    </p>
                  </div>
                  <select
                    value={o.status} disabled={busy === o.id}
                    onChange={(e) => setStatus(o.id, e.target.value)}
                    className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 focus:outline-none disabled:opacity-50"
                  >
                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="mt-3 space-y-0.5 text-sm text-neutral-400">
                  {(o.items ?? []).map((it, i) => (
                    <div key={i}>{it.qty}× {it.name} <span className="text-neutral-600">(${(it.price_cents / 100).toFixed(2)})</span></div>
                  ))}
                </div>
                {o.ship_name && (
                  <p className="mt-2 font-dm-mono text-[11px] text-neutral-600">
                    Ship to: {o.ship_name}{o.ship_address ? ` · ${[o.ship_address.line1, o.ship_address.city, o.ship_address.state, o.ship_address.postal_code].filter(Boolean).join(", ")}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
