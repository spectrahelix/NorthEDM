"use client";
import { useState } from "react";

type Application = {
  id: string; business_name: string; contact_name: string; email: string;
  phone: string | null; product_types: string; typical_events: string | null;
  has_tablet: string | null; notes: string | null; status: string;
  vendor_id: number | null; created_at: string;
};
type ActiveVendor = {
  id: number; vendor_id: number; is_active: boolean; joined_at: string;
  vendors: { name: string; category: string } | { name: string; category: string }[] | null;
};

function vendorName(v: ActiveVendor): string {
  if (!v.vendors) return `Vendor #${v.vendor_id}`;
  if (Array.isArray(v.vendors)) return v.vendors[0]?.name ?? `Vendor #${v.vendor_id}`;
  return v.vendors.name;
}
function vendorCategory(v: ActiveVendor): string {
  if (!v.vendors) return "";
  if (Array.isArray(v.vendors)) return v.vendors[0]?.category ?? "";
  return v.vendors.category;
}
type Order = {
  id: string; customer_name: string; event_name: string;
  status: string; total_cents: number; created_at: string;
};
type UnenrolledVendor = { id: number; name: string; category: string };

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
  activeVendors: initialActiveVendors,
  recentOrders,
  unenrolledVendors: initialUnenrolled,
}: {
  applications: Application[];
  activeVendors: ActiveVendor[];
  recentOrders: Order[];
  unenrolledVendors: UnenrolledVendor[];
}) {
  const [applications, setApplications] = useState(initial);
  const [activeVendors, setActiveVendors] = useState(initialActiveVendors);
  const [unenrolled, setUnenrolled] = useState(initialUnenrolled);
  const [acting, setActing] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

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

  async function enrollVendor(vendor: UnenrolledVendor) {
    setEnrolling(vendor.id);
    const res = await fetch("/api/festdash/admin/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId: vendor.id }),
    });
    if (res.ok) {
      setUnenrolled((prev) => prev.filter((v) => v.id !== vendor.id));
      setActiveVendors((prev) => [...prev, {
        id: Date.now(),
        vendor_id: vendor.id,
        is_active: true,
        joined_at: new Date().toISOString(),
        vendors: { name: vendor.name, category: vendor.category },
      }]);
    }
    setEnrolling(null);
  }

  async function toggleVendor(fdVendorId: number, isActive: boolean) {
    setToggling(fdVendorId);
    const res = await fetch("/api/festdash/admin/vendors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ festdashVendorId: fdVendorId, isActive }),
    });
    if (res.ok) {
      setActiveVendors((prev) =>
        prev.map((v) => v.id === fdVendorId ? { ...v, is_active: isActive } : v)
      );
    }
    setToggling(null);
  }

  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");
  const enrolledActive = activeVendors.filter((v) => v.is_active);
  const enrolledInactive = activeVendors.filter((v) => !v.is_active);

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-400">Admin</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-wide text-white">FestDash Control</h1>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: "Active Vendors", value: enrolledActive.length },
            { label: "Pending Applications", value: pending.length },
            { label: "Recent Orders", value: recentOrders.length },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 bg-white/3 p-5 text-center">
              <div className="font-bebas text-4xl text-orange-400">{s.value}</div>
              <div className="mt-1 text-xs text-neutral-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Direct Enrollment */}
        {unenrolled.length > 0 && (
          <>
            <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-blue-400">
              Direct Enroll — Approved Vendors ({unenrolled.length})
            </h2>
            <p className="mb-4 text-xs text-neutral-600">Add any approved vendor to FestDash without requiring an application.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {unenrolled.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-950/10 px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">{v.name}</p>
                    <p className="text-xs text-neutral-500">{v.category}</p>
                  </div>
                  <button
                    onClick={() => enrollVendor(v)}
                    disabled={enrolling === v.id}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {enrolling === v.id ? "Adding…" : "Enroll"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

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

        {/* Active FestDash vendors */}
        <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Active FestDash Vendors ({enrolledActive.length})
        </h2>
        {enrolledActive.length === 0 ? (
          <p className="text-sm text-neutral-600">No active vendors yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {enrolledActive.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 p-4">
                <div>
                  <p className="font-semibold text-white">{vendorName(v)}</p>
                  <p className="text-xs text-neutral-500">{vendorCategory(v)}</p>
                  <p className="mt-1 text-xs text-neutral-600">
                    Joined {new Date(v.joined_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => toggleVendor(v.id, false)}
                  disabled={toggling === v.id}
                  className="rounded-xl border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/20 disabled:opacity-50"
                >
                  {toggling === v.id ? "…" : "Deactivate"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Inactive vendors */}
        {enrolledInactive.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-700">
              Inactive ({enrolledInactive.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {enrolledInactive.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/2 p-4 opacity-60">
                  <div>
                    <p className="text-neutral-400">{vendorName(v)}</p>
                    <p className="text-xs text-neutral-600">{vendorCategory(v)}</p>
                  </div>
                  <button
                    onClick={() => toggleVendor(v.id, true)}
                    disabled={toggling === v.id}
                    className="rounded-xl border border-green-500/30 px-3 py-1.5 text-xs text-green-400 hover:bg-green-950/20 disabled:opacity-50"
                  >
                    {toggling === v.id ? "…" : "Reactivate"}
                  </button>
                </div>
              ))}
            </div>
          </>
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
