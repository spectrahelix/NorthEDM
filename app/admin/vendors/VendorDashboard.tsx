"use client";
import { AppliedAt } from "@/app/components/AppliedAt";

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
  wants_public: boolean | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string | null;
  user_id: string | null;
  business_email: string | null;
  linked_email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  website: string | null;
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

  const [note, setNote] = useState("");

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
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Failed to update vendor");
      }
      // Approving can succeed at the status and still fail to grant access —
      // usually because they applied before making an account. Say which
      // happened; approving into silence is how a vendor sits "approved" with
      // no dashboard and nobody notices.
      if (json.note) setNote(json.note);
      router.refresh();
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setLoadingId(null);
    }
  }

  async function linkAccount(id: number, email: string) {
    setLoadingId(id);
    try {
      const res = await fetch("/api/vendors/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "link", email }),
      });
      const json = await res.json().catch(() => ({}));
      setNote(json.note || json.error || (res.ok ? "Linked." : "Couldn't link that account."));
      if (res.ok && json.linked) router.refresh();
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setLoadingId(null);
    }
  }

  async function setSuspended(id: number, suspend: boolean) {
    const reason = suspend
      ? window.prompt("Why? (shown only to you)", "Unpaid invoice")
      : null;
    if (suspend && reason === null) return; // cancelled
    setLoadingId(id);
    try {
      const res = await fetch("/api/vendors/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: suspend ? "suspend" : "unsuspend", reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Could not change that.");
      }
      if (json.note) setNote(json.note);
      router.refresh();
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      {note && (
        <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-[#3AFFD4]/25 bg-[#3AFFD4]/[0.07] px-4 py-3 text-sm text-[#3AFFD4]">
          <span>{note}</span>
          <button onClick={() => setNote("")} className="shrink-0 opacity-70 hover:opacity-100">
            dismiss
          </button>
        </div>
      )}

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
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-white">
                        {v.name || "Unnamed business"}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {applicantName(v) ?? "Applicant name not given"}
                        {v.email ? ` · ${v.email}` : ""}
                      </span>
                    </span>
                    <span className="hidden shrink-0 truncate text-xs text-neutral-500 sm:inline">
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
                <div className="-mt-1 pb-3 pl-11 pr-4">
                  <AppliedAt at={v.created_at} waiting={status === "pending"} />
                </div>

                {/* Expanded detail + full actions */}
                {isOpen && (
                  <div className="border-t border-white/10 px-4 py-4">
                    <ApplicationDetails vendor={v} />
                    <LinkAccount
                      vendor={v}
                      busy={busy}
                      onLink={(email) => linkAccount(v.id, email)}
                    />
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
                      {/* What they ASKED for. An applicant cannot set is_public
                          — the RLS policy forbids it — so without this the
                          request was invisible and every applicant looked like
                          they wanted to stay private. */}
                      {v.suspended_at && (
                        <span className="rounded-full bg-orange-500/20 px-3 py-1 text-orange-300">
                          suspended — hidden from public
                          {v.suspended_reason ? `: ${v.suspended_reason}` : ""}
                        </span>
                      )}
                      {v.wants_public && !v.is_public && (
                        <span className="rounded-full bg-[#3AFFD4]/15 px-3 py-1 text-[#3AFFD4]">
                          asked to be listed publicly
                        </span>
                      )}
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
                      {v.suspended_at ? (
                        <button
                          onClick={() => setSuspended(v.id, false)}
                          disabled={busy}
                          className="rounded-xl bg-[#39FF14]/20 px-3 py-2 text-sm text-[#39FF14] disabled:opacity-50"
                        >
                          Restore public view
                        </button>
                      ) : (
                        <button
                          onClick={() => setSuspended(v.id, true)}
                          disabled={busy}
                          className="rounded-xl bg-orange-500/20 px-3 py-2 text-sm text-orange-300 disabled:opacity-50"
                        >
                          Suspend (unpaid)
                        </button>
                      )}
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

/**
 * Who runs this vendor, and a box to change it.
 *
 * Exists because the first real vendor applied with a business email while
 * signing in with a personal one, so approval had no account to connect to
 * and there was no way, short of SQL, to point it at the right person.
 */
function LinkAccount({
  vendor,
  busy,
  onLink,
}: {
  vendor: Vendor;
  busy: boolean;
  onLink: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const linked = !!vendor.user_id;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
      {linked ? (
        <p className="text-sm text-[#39FF14]">
          ✓ Managed by{" "}
          <span className="font-medium">{vendor.linked_email ?? "an account"}</span>
          <span className="text-neutral-500"> — they have the vendor dashboard.</span>
        </p>
      ) : (
        <p className="text-sm text-[#FFC93C]">
          Not linked to any account — nobody can manage this vendor yet.
        </p>
      )}
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) onLink(email.trim());
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={linked ? "Move to a different account's email" : "Email they sign in with"}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded-lg bg-[#3AFFD4]/20 px-3 py-2 text-sm text-[#3AFFD4] disabled:opacity-40"
        >
          {linked ? "Move" : "Link to account"}
        </button>
      </form>
    </div>
  );
}

function applicantName(v: Vendor): string | null {
  const n = [v.first_name, v.last_name].filter(Boolean).join(" ").trim();
  return n || null;
}

/**
 * Everything they submitted, labelled. Applications from before first/last
 * name existed say so rather than showing blanks that look like a bug.
 */
function ApplicationDetails({ vendor: v }: { vendor: Vendor }) {
  const rows: [string, React.ReactNode][] = [
    ["Business", v.name || "—"],
    ["Applicant", applicantName(v) ?? <span className="text-neutral-600">not collected on older applications</span>],
    ["Personal email", v.email ? <a href={`mailto:${v.email}`} className="hover:text-white">{v.email}</a> : "—"],
    ["Business email", v.business_email ? <a href={`mailto:${v.business_email}`} className="hover:text-white">{v.business_email}</a> : "—"],
    ["Phone", v.phone || "—"],
    ["Website", v.website ? <a href={v.website} target="_blank" rel="noreferrer" className="break-all hover:text-white">{v.website}</a> : "—"],
    ["Category", v.category || "—"],
    ["Capacity", v.capacity || "—"],
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[9rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-600">{label}</dt>
            <dd className="min-w-0 text-neutral-300">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs uppercase tracking-widest text-neutral-600">Purpose</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">
        {v.description || "—"}
      </p>
    </div>
  );
}
