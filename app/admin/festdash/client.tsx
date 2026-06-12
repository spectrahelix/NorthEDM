"use client";
import { useState } from "react";

type Application = {
  id: string; business_name: string; contact_name: string; email: string;
  phone: string | null; product_types: string; typical_events: string | null;
  has_tablet: string | null; notes: string | null; status: string;
  vendor_id: number | null; created_at: string;
};
type ActiveVendor = {
  id: number; vendor_id: number; joined_at: string;
  vendors: { name: string; category: string } | null;
};
type Order = {
  id: string; customer_name: string; event_name: string;
  status: string; total_cents: number; created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-yellow-500/20 text-yellow-400",
  approved:   "bg-green-500/20 text-green-400",
  rejected:   "bg-red-500/20 text-red-400",
  in_transit: "bg-purple-500/20 text-purple-400",
  accepted:   "bg-blue-500/20 text-blue-400",
  delivered:  "bg-green-500/20 text-green-400",
  declined:   "bg-neutral-500/20 text-neutral-500",
};

export default function FestDashAdminClient({
  applications: initial,
  activeVendors,
  recentOrders,
}: {
  applications: Application[];
  activeVendors: ActiveVendor[];
  recentOrders: Order[];
}) {
  const [applications, setApplications] = useState(initial);
  const [acting, setActing] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setActing(id);
    const res = await fetch(`/api/festdash/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setApplications((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: action === "approve" ? "approved" : "rejected" } : a)
      );
    }
    setActing(null);
  }

  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-400">Admin</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-wide text-white">FestDash Control</h1>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: "Active Vendors", value: activeVendors.length },
            { label: "Pending Applications", value: pending.length },
            { label: "Total Orders", value: recentOrders.length },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 bg-white/3 p-5 text-center">
              <div className="font-bebas text-4xl text-orange-400">{s.value}</div>
              <div className="mt-1 text-xs text-neutral-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pending applications */}
        <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Pending Applications ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-neutral-600">No pending applications.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((app) => (
              <div key={app.id} className="rounded-2xl border border-yellow-500/20 bg-yellow-950/10 p-5">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{app.business_name}</p>
                    <p className="text-sm text-neutral-400">{app.contact_name} · {app.email}</p>
                    {app.phone && <p className="text-sm text-neutral-500">{app.phone}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${STATUS_COLORS[app.status]}`}>
                    {app.status}
                  </span>
                </div>
                <div className="mb-3 space-y-1 text-sm text-neutral-400">
                  <p><span className="text-neutral-600">Products: </span>{app.product_types}</p>
                  {app.typical_events && <p><span className="text-neutral-600">Events: </span>{app.typical_events}</p>}
                  {app.has_tablet && <p><span className="text-neutral-600">Tablet: </span>{app.has_tablet}</p>}
                  {app.vendor_id && <p><span className="text-neutral-600">Vendor ID: </span>{app.vendor_id}</p>}
                  {app.notes && <p><span className="text-neutral-600">Notes: </span>{app.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(app.id, "approve")}
                    disabled={acting === app.id}
                    className="flex-1 rounded-xl bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    {acting === app.id ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => act(app.id, "reject")}
                    disabled={acting === app.id}
                    className="flex-1 rounded-xl border border-red-500/30 py-2.5 text-red-400 hover:bg-red-950/20 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active vendors */}
        <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Active FestDash Vendors ({activeVendors.length})
        </h2>
        {activeVendors.length === 0 ? (
          <p className="text-sm text-neutral-600">No approved vendors yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeVendors.map((v) => (
              <div key={v.id} className="rounded-xl border border-white/8 bg-white/3 p-4">
                <p className="font-semibold text-white">{v.vendors?.name ?? `Vendor #${v.vendor_id}`}</p>
                <p className="text-xs text-neutral-500">{v.vendors?.category}</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Joined {new Date(v.joined_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Recent orders */}
        <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Recent Orders ({recentOrders.length})
        </h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-neutral-600">No orders yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/8">
            {recentOrders.map((order, i) => (
              <div
                key={order.id}
                className={`flex items-center justify-between px-5 py-3 ${i % 2 === 0 ? "bg-white/2" : ""}`}
              >
                <div>
                  <p className="text-sm font-medium text-white">{order.customer_name}</p>
                  <p className="text-xs text-neutral-500">{order.event_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-neutral-400">${(order.total_cents / 100).toFixed(2)}</span>
                  <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${STATUS_COLORS[order.status] ?? "text-neutral-500"}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reviewed applications */}
        {reviewed.length > 0 && (
          <>
            <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
              Reviewed Applications
            </h2>
            <div className="space-y-2">
              {reviewed.map((app) => (
                <div key={app.id} className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
                  <div>
                    <p className="text-sm text-neutral-300">{app.business_name}</p>
                    <p className="text-xs text-neutral-600">{app.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] ${STATUS_COLORS[app.status]}`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
