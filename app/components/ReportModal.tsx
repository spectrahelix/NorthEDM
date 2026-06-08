"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

const REASONS = [
  { value: "harassment",     label: "Harassment" },
  { value: "hate_speech",    label: "Hate Speech" },
  { value: "spam",           label: "Spam" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other",          label: "Other" },
] as const;

export function ReportButton({
  reporterId,
  reportedUserId,
  threadId,
  replyId,
}: {
  reporterId: string | null;
  reportedUserId: string;
  threadId?: number;
  replyId?: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("harassment");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!reporterId || reporterId === reportedUserId) return null;
  if (done) {
    return (
      <span className="font-dm-mono text-[10px] text-neutral-700">
        reported
      </span>
    );
  }

  async function submit() {
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from("reports").insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      thread_id: threadId ?? null,
      reply_id: replyId ?? null,
      reason,
      details: details.trim() || null,
    });

    const { data: admins } = await supabase
      .from("user_profiles")
      .select("id")
      .in("role", ["archon", "warden"]);

    if (admins && admins.length > 0) {
      await supabase.from("notifications").insert(
        (admins as { id: string }[]).map((a) => ({
          user_id: a.id,
          type: "report",
          message: `New report: ${reason.replace("_", " ")}`,
          link: "/admin/reports",
        }))
      );
    }

    setSubmitting(false);
    setDone(true);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="font-dm-mono text-xs text-neutral-700 transition hover:text-[#FF5C3A]"
        title="Report this post"
      >
        ⚑
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wide">
                Report Content
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-xl text-neutral-500 transition hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 focus:outline-none"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Details{" "}
                  <span className="normal-case tracking-normal text-neutral-700">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  placeholder="Any additional context…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-400 transition hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-xl bg-[#FF5C3A] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
