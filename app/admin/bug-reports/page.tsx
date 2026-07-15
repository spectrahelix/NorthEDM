"use client";

import { useEffect, useState } from "react";

type Report = {
  id: string;
  email: string | null;
  description: string | null;
  screenshot_url: string | null;
  page_url: string | null;
  user_agent: string | null;
  viewport: string | null;
  console_errors: { message: string; source?: string; stack?: string; at: string }[];
  status: string;
  github_issue_url: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  new: "bg-[#FF5C3A]/15 text-[#FF5C3A]",
  triaged: "bg-[#E8FF47]/15 text-[#E8FF47]",
  fixed: "bg-[#39FF14]/15 text-[#39FF14]",
  dismissed: "bg-white/5 text-neutral-500",
};

export default function AdminBugReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("open");

  async function load() {
    const res = await fetch("/api/admin/bug-reports");
    if (res.status === 401 || res.status === 403) { setForbidden(true); setLoading(false); return; }
    const j = await res.json().catch(() => ({}));
    setReports(j.reports ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    await fetch("/api/admin/bug-reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center admin-surface"><p className="font-dm-mono text-sm text-neutral-500">Loading…</p></main>;
  if (forbidden) return <main className="flex min-h-screen items-center justify-center admin-surface text-neutral-400">Forbidden.</main>;

  const shown = reports.filter((r) => filter === "all" ? true : filter === "open" ? (r.status === "new" || r.status === "triaged") : r.status === filter);

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-3xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#FF5C3A]">Admin · Bug Reports</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Reported Problems</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          User-submitted reports with the screenshot + the auto-captured page, browser, and JS errors.
          Set <span className="text-neutral-300">GITHUB_ISSUES_TOKEN</span> in the env to also auto-open a fix-ready GitHub issue per report.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {["open", "new", "triaged", "fixed", "dismissed", "all"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 font-dm-mono text-xs uppercase tracking-widest transition ${filter === f ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
              {f}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">Nothing here.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {shown.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-200">{r.description || <span className="text-neutral-600">(no description)</span>}</p>
                    <p className="mt-1 font-dm-mono text-[11px] text-neutral-500">
                      {new Date(r.created_at).toLocaleString()} · {r.email || "anonymous"} · {r.viewport || "—"}
                    </p>
                    {r.page_url && <p className="mt-0.5 truncate font-dm-mono text-[11px] text-neutral-600">{r.page_url}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</span>
                </div>

                {r.screenshot_url && (
                  <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.screenshot_url} alt="screenshot" className="max-h-64 rounded-xl border border-white/10 object-contain" />
                  </a>
                )}

                {Array.isArray(r.console_errors) && r.console_errors.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-dm-mono text-xs text-[#FF5C3A]">{r.console_errors.length} captured JS error(s)</summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 font-dm-mono text-[11px] leading-relaxed text-neutral-400">{JSON.stringify(r.console_errors, null, 2)}</pre>
                  </details>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {r.github_issue_url && <a href={r.github_issue_url} target="_blank" rel="noopener noreferrer" className="font-dm-mono text-xs text-[#3AFFD4] hover:underline">GitHub issue ↗</a>}
                  <div className="ml-auto flex gap-2">
                    {(["triaged", "fixed", "dismissed"] as const).map((s) => (
                      <button key={s} onClick={() => setStatus(r.id, s)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 font-dm-mono text-xs text-neutral-300 transition hover:bg-white/5">
                        Mark {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
