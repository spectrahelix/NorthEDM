"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

type Report = {
  id: number;
  reporter_id: string;
  reported_user_id: string;
  thread_id: number | null;
  reply_id: number | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  reviewed_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string;
  reported_name?: string;
  reported_role?: string;
};

const STATUS_COLORS: Record<string, string> = {
  open:       "bg-[#FF5C3A]/10 text-[#FF5C3A]",
  reviewing:  "bg-[#E8FF47]/10 text-[#E8FF47]",
  resolved:   "bg-[#3AFFD4]/10 text-[#3AFFD4]",
  dismissed:  "bg-white/5 text-neutral-500",
};

const REASON_LABELS: Record<string, string> = {
  harassment:     "Harassment",
  hate_speech:    "Hate Speech",
  spam:           "Spam",
  misinformation: "Misinformation",
  other:          "Other",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [filtered, setFiltered] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchReports = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { router.push("/"); return; }

    const rpts = (data ?? []) as Report[];

    const userIds = [
      ...new Set([
        ...rpts.map((r) => r.reporter_id),
        ...rpts.map((r) => r.reported_user_id),
      ]),
    ];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, role")
        .in("id", userIds);
      const pMap: Record<string, { display_name: string; role: string }> = {};
      for (const p of (profiles ?? []) as { id: string; display_name: string; role: string }[]) {
        pMap[p.id] = p;
      }
      for (const r of rpts) {
        r.reporter_name = pMap[r.reporter_id]?.display_name ?? "Unknown";
        r.reported_name = pMap[r.reported_user_id]?.display_name ?? "Unknown";
        r.reported_role = pMap[r.reported_user_id]?.role ?? "drifter";
      }
    }

    setReports(rpts);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (p?.role !== "archon" && p?.role !== "warden") {
        router.push("/");
        return;
      }
      fetchReports();
    });
  }, [router, fetchReports]);

  useEffect(() => {
    if (statusFilter === "all") {
      setFiltered(reports);
    } else {
      setFiltered(reports.filter((r) => r.status === statusFilter));
    }
  }, [statusFilter, reports]);

  async function updateReport(
    id: number,
    status: string,
    notes?: string
  ) {
    setSavingId(id);
    const res = await fetch("/api/admin/update-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: id, status, resolutionNotes: notes }),
    });
    setSavingId(null);
    if (res.ok) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: status as Report["status"], resolution_notes: notes ?? null }
            : r
        )
      );
      setExpanded(null);
      setResolutionNote("");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="font-dm-mono text-sm text-neutral-500">Loading reports…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 admin-surface">
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-dm-mono text-xs text-neutral-600 hover:text-neutral-400">
              ← Admin
            </Link>
            <span className="text-neutral-800">|</span>
            <p className="font-dm-mono text-xs uppercase tracking-widest text-[#FF5C3A]">
              Reports
            </p>
          </div>
          <h1 className="mt-2 font-bebas text-4xl tracking-wide">Content Reports</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Status filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {["all", "open", "reviewing", "resolved", "dismissed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-4 py-1.5 font-dm-mono text-xs uppercase tracking-widest transition ${
                statusFilter === s
                  ? "bg-[#E8FF47]/10 text-[#E8FF47]"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {s} ({s === "all" ? reports.length : reports.filter((r) => r.status === s).length})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm text-neutral-500">No {statusFilter} reports</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => {
              const isExp = expanded === report.id;
              return (
                <div
                  key={report.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(isExp ? null : report.id)}
                    className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-white/[0.02]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            STATUS_COLORS[report.status]
                          }`}
                        >
                          {report.status}
                        </span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
                          {REASON_LABELS[report.reason] ?? report.reason}
                        </span>
                        <span className="font-dm-mono text-[10px] text-neutral-600">
                          {timeAgo(report.created_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
                        <Link
                          href={`/profile/${report.reporter_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:text-white hover:underline"
                        >
                          {report.reporter_name}
                        </Link>
                        <span className="text-neutral-600">reported</span>
                        <Link
                          href={`/profile/${report.reported_user_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:text-white hover:underline"
                        >
                          {report.reported_name}
                        </Link>
                        <span className="font-dm-mono text-[10px] text-neutral-700">
                          ({report.reported_role})
                        </span>
                      </div>
                      {report.thread_id && (
                        <div className="mt-1.5">
                          <Link
                            href={`/forum/${report.thread_id}`}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="font-dm-mono text-[10px] text-neutral-600 hover:text-neutral-400"
                          >
                            View thread #{report.thread_id} ↗
                          </Link>
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-neutral-600">{isExp ? "▲" : "▼"}</span>
                  </button>

                  {isExp && (
                    <div className="border-t border-white/10 px-5 pb-5 pt-4">
                      {report.details && (
                        <div className="mb-4 rounded-xl bg-white/[0.03] px-4 py-3">
                          <p className="mb-1 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                            Details
                          </p>
                          <p className="text-sm text-neutral-300">{report.details}</p>
                        </div>
                      )}
                      {report.resolution_notes && (
                        <div className="mb-4 rounded-xl bg-[#3AFFD4]/5 px-4 py-3">
                          <p className="mb-1 font-dm-mono text-[10px] uppercase tracking-widest text-[#3AFFD4]/70">
                            Resolution
                          </p>
                          <p className="text-sm text-neutral-300">{report.resolution_notes}</p>
                        </div>
                      )}
                      {(report.status === "open" || report.status === "reviewing") && (
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                              Resolution Notes
                            </label>
                            <textarea
                              value={resolutionNote}
                              onChange={(e) => setResolutionNote(e.target.value)}
                              rows={2}
                              placeholder="Optional notes for resolve/dismiss…"
                              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-700 focus:outline-none"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {report.status === "open" && (
                              <button
                                onClick={() => updateReport(report.id, "reviewing")}
                                disabled={savingId === report.id}
                                className="rounded-xl bg-[#E8FF47]/10 px-4 py-2 text-xs font-medium text-[#E8FF47] transition hover:bg-[#E8FF47]/20 disabled:opacity-50"
                              >
                                Mark Reviewing
                              </button>
                            )}
                            <button
                              onClick={() => updateReport(report.id, "resolved", resolutionNote || undefined)}
                              disabled={savingId === report.id}
                              className="rounded-xl bg-[#3AFFD4]/10 px-4 py-2 text-xs font-medium text-[#3AFFD4] transition hover:bg-[#3AFFD4]/20 disabled:opacity-50"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => updateReport(report.id, "dismissed", resolutionNote || undefined)}
                              disabled={savingId === report.id}
                              className="rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-neutral-400 transition hover:bg-white/10 disabled:opacity-50"
                            >
                              Dismiss
                            </button>
                            {savingId === report.id && (
                              <span className="self-center font-dm-mono text-[10px] text-neutral-600">
                                saving…
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
