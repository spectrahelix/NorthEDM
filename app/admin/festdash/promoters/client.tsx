"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Application = {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  audience: string | null;
  promote_vendor: string | null;
  why: string | null;
  status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

export default function PromoterApplicationsClient() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/festdash/admin/promoter-applications");
    const json = await res.json();
    setApps(json.applications ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    const res = await fetch(`/api/festdash/admin/promoter-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setApps((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: action === "approve" ? "approved" : "rejected" } : a
        )
      );
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Action failed.");
    }
    setBusy(null);
  }

  const pending = apps.filter((a) => a.status === "pending");
  const decided = apps.filter((a) => a.status !== "pending");

  return (
    <main className="min-h-screen p-4 lg:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-bebas text-3xl tracking-wide text-white">
              Promoter <span className="text-orange-400">Applications</span>
            </h1>
            <Link href="/admin/festdash" className="font-dm-mono text-xs text-neutral-500 hover:text-neutral-300">
              ← FestDash admin
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : (
          <>
            <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Pending ({pending.length})
            </h2>
            {pending.length === 0 && (
              <p className="mb-8 text-sm text-neutral-600">No pending applications.</p>
            )}
            <div className="mb-10 space-y-3">
              {pending.map((a) => (
                <ApplicationCard key={a.id} app={a} busy={busy === a.id} onAct={act} />
              ))}
            </div>

            {decided.length > 0 && (
              <>
                <h2 className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Decided ({decided.length})
                </h2>
                <div className="space-y-3">
                  {decided.map((a) => (
                    <ApplicationCard key={a.id} app={a} busy={false} onAct={act} decided />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function ApplicationCard({
  app,
  busy,
  onAct,
  decided,
}: {
  app: Application;
  busy: boolean;
  onAct: (id: string, action: "approve" | "reject") => void;
  decided?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{app.display_name}</p>
          <p className="text-sm text-neutral-400">{app.email}{app.phone ? ` · ${app.phone}` : ""}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[app.status] ?? ""}`}>
          {app.status}
        </span>
      </div>
      {app.promote_vendor && (
        <p className="text-sm text-neutral-300"><span className="text-neutral-500">Wants to promote:</span> {app.promote_vendor}</p>
      )}
      {app.audience && (
        <p className="text-sm text-neutral-300"><span className="text-neutral-500">Reach:</span> {app.audience}</p>
      )}
      {app.why && (
        <p className="mt-1 text-sm text-neutral-400">{app.why}</p>
      )}
      {!decided && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onAct(app.id, "approve")}
            disabled={busy}
            className="rounded-xl bg-green-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
          >
            {busy ? "…" : "Approve"}
          </button>
          <button
            onClick={() => onAct(app.id, "reject")}
            disabled={busy}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/5 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
