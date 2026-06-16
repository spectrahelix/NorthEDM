"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type Vendor = {
  id: number;
  name: string | null;
  email: string | null;
  category: string | null;
  description: string | null;
  capacity: string | null;
  vendor_type: string | null;
  is_public: boolean | null;
  is_founder: boolean | null;
  status: string | null;
};

type FilterKey = "pending" | "approved" | "rejected" | "all";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-500/20 text-green-300",
  rejected: "bg-red-500/20 text-red-300",
  pending: "bg-yellow-500/20 text-yellow-300",
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function VendorDashboard({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const statusOf = (v: Vendor) => v.status ?? "pending";

  const counts: Record<FilterKey, number> = {
    all: vendors.length,
    pending: vendors.filter((v) => statusOf(v) === "pending").length,
    approved: vendors.filter((v) => statusOf(v) === "approved").length,
    rejected: vendors.filter((v) => statusOf(v) === "rejected").length,
  };

  const shown = vendors.filter((v) => filter === "all" || statusOf(v) === filter);

  async function updateVendor(
    id: number,
    status: string,
    vendorType: string,
    isPublic: boolean
  ) {
    setLoadingId(id);
    try {
      const res = await fetch("/api/vendors/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, vendorType, isPublic }),
      });
      if (!res.ok) throw new Error("Failed to update vendor");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Could not update vendor.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      {/* Status filter chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              filter === f.key
                ? "bg-white/15 text-white"
                : "bg-white/[0.04] text-neutral-400 hover:text-white"
            }`}
          >
            {f.label}
            <span className="ml-2 font-dm-mono text-xs text-neutral-500">
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {shown.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-neutral-500">
            No {filter === "all" ? "" : filter} vendors.
          </div>
        ) : (
          shown.map((v) => {
            const status = statusOf(v);
            const isOpen = expanded === v.id;
            const busy = loadingId === v.id;
            return (
              <div
                key={v.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
              >
                {/* Collapsed header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpanded(isOpen ? null : v.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={`shrink-0 text-neutral-500 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    >
                      ▸
                    </span>
                    <span className="truncate font-medium text-white">
                      {v.name || "Unnamed Vendor"}
                    </span>
                    <span className="hidden truncate text-xs text-neutral-500 sm:inline">
                      {v.category || "uncategorized"}
                    </span>
                  </button>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${
                      STATUS_STYLES[status] ?? STATUS_STYLES.pending
                    }`}
                  >
                    {status}
                  </span>

                  {/* Quick approve / deny for pending */}
                  {status === "pending" && (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() =>
                          updateVendor(v.id, "approved", v.vendor_type || "listed", v.is_public ?? false)
                        }
                        disabled={busy}
                        title="Approve"
                        className="rounded-lg bg-green-500/20 px-2.5 py-1 text-xs text-green-300 disabled:opacity-50"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() =>
                          updateVendor(v.id, "rejected", v.vendor_type || "listed", v.is_public ?? false)
                        }
                        disabled={busy}
                        title="Deny"
                        className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs text-red-300 disabled:opacity-50"
                      >
                        ✕ Deny
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded detail + full actions */}
                {isOpen && (
                  <div className="border-t border-white/10 px-4 py-4">
                    <p className="text-sm text-neutral-400">{v.email || "No email"}</p>
                    <p className="mt-2 text-sm text-neutral-300">
                      {v.description || "No description"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {v.category || "uncategorized"}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {v.vendor_type || "unknown"}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        capacity: {v.capacity || "unknown"}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        public: {v.is_public ? "yes" : "no"}
                      </span>
                      {v.is_founder && (
                        <span className="rounded-full bg-purple-500/20 px-3 py-1 text-purple-300">
                          founder
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          updateVendor(v.id, "approved", v.vendor_type || "listed", v.is_public ?? false)
                        }
                        disabled={busy}
                        className="rounded-xl bg-green-500/20 px-3 py-2 text-sm text-green-300 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          updateVendor(v.id, "rejected", v.vendor_type || "listed", v.is_public ?? false)
                        }
                        disabled={busy}
                        className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-300 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => updateVendor(v.id, "approved", "listed", true)}
                        disabled={busy}
                        className="rounded-xl bg-blue-500/20 px-3 py-2 text-sm text-blue-300 disabled:opacity-50"
                      >
                        Make Listed
                      </button>
                      <button
                        onClick={() => updateVendor(v.id, "approved", "featured", true)}
                        disabled={busy}
                        className="rounded-xl bg-purple-500/20 px-3 py-2 text-sm text-purple-300 disabled:opacity-50"
                      >
                        Make Featured
                      </button>
                      <button
                        onClick={() => updateVendor(v.id, "approved", "private", false)}
                        disabled={busy}
                        className="rounded-xl bg-yellow-500/20 px-3 py-2 text-sm text-yellow-300 disabled:opacity-50"
                      >
                        Make Private
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
