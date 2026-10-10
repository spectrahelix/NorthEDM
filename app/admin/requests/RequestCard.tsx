"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppliedAt } from "@/app/components/AppliedAt";

export type ServiceRequest = {
  id: number;
  created_at: string;
  name: string | null;
  email: string | null;
  service_type: string | null;
  description: string | null;
  status: string | null;
  urgency: string | null;
  budget: string | null;
};

export type Reply = {
  id: number;
  request_id: number;
  body: string;
  sent_to: string;
  delivered: boolean;
  created_at: string;
};

const STATUS: Record<string, { label: string; style: string }> = {
  pending: { label: "Pending", style: "bg-yellow-500/15 text-yellow-300" },
  accepted: { label: "Accepted", style: "bg-[#39FF14]/15 text-[#39FF14]" },
  in_progress: { label: "In progress", style: "bg-[#00D4FF]/15 text-[#00D4FF]" },
  completed: { label: "Completed", style: "bg-white/10 text-neutral-300" },
  declined: { label: "Declined", style: "bg-red-500/15 text-red-300" },
};

// Starting points for a reply, not sent automatically — the owner edits them
// first. Kept short because they are meant to be personalised.
const TEMPLATES: { label: string; text: (r: ServiceRequest) => string }[] = [
  {
    label: "Accept",
    text: (r) =>
      `Thanks for reaching out about ${r.service_type || "your request"}. I'd be glad to help. Could you tell me a good time to talk, and any details that would help me prepare?`,
  },
  {
    label: "Need more info",
    text: () =>
      `Thanks for your request. Before I can give you an answer, could you tell me a bit more about what you need and your timeline?`,
  },
  {
    label: "Decline",
    text: (r) =>
      `Thanks for thinking of NorthEDM for ${r.service_type || "this"}. Unfortunately I'm not able to take this on right now. I appreciate you reaching out, and I hope you find the right fit.`,
  },
];

export function RequestCard({ request: r, replies }: { request: ServiceRequest; replies: Reply[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(r.status === "pending" || !r.status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const status = STATUS[r.status ?? "pending"] ?? STATUS.pending;

  async function call(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setNote({ text: success, ok: true });
      return true;
    } catch (e) {
      setNote({ text: (e as Error).message, ok: false });
      return false;
    } finally {
      setBusy(false);
      // Refresh either way: a failed reply is still recorded and should show.
      router.refresh();
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <p className="font-medium text-white">
            {r.name || "No name"}
            <span className="ml-2 text-sm font-normal text-neutral-500">{r.service_type || "—"}</span>
          </p>
          <p className="truncate text-sm text-neutral-400">{r.description || "No description"}</p>
          <AppliedAt at={r.created_at} waiting={(r.status ?? "pending") === "pending"} />
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${status.style}`}>{status.label}</span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-white/10 px-5 py-5">
          {/* The request in full */}
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7rem_1fr]">
            <dt className="text-neutral-600">Email</dt>
            <dd className="text-neutral-300">
              {r.email ? (
                <a href={`mailto:${r.email}`} className="hover:text-white">{r.email}</a>
              ) : "—"}
            </dd>
            <dt className="text-neutral-600">Urgency</dt>
            <dd className="text-neutral-300">{r.urgency || "—"}</dd>
            <dt className="text-neutral-600">Budget</dt>
            <dd className="text-neutral-300">{r.budget || "—"}</dd>
          </dl>
          <p className="whitespace-pre-wrap text-sm text-neutral-300">{r.description || "—"}</p>

          {/* Status */}
          <div>
            <p className="mb-2 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy || (r.status ?? "pending") === key}
                  onClick={() => call({ action: "status", status: key }, `Marked ${s.label.toLowerCase()}.`)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition disabled:cursor-default ${
                    (r.status ?? "pending") === key ? `${s.style} ring-1 ring-current` : "bg-white/5 text-neutral-300 hover:bg-white/10"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-neutral-600">
              Changing the status doesn&apos;t email them — use a reply below for that.
            </p>
          </div>

          {/* Conversation so far */}
          {replies.length > 0 && (
            <div>
              <p className="mb-2 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                Replies sent
              </p>
              <ul className="space-y-2">
                {replies.map((rep) => (
                  <li key={rep.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                    <p className="whitespace-pre-wrap text-neutral-300">{rep.body}</p>
                    <p className={`mt-1.5 text-xs ${rep.delivered ? "text-neutral-600" : "text-[#FF5C3A]"}`}>
                      {rep.delivered ? "Sent" : "NOT delivered"} to {rep.sent_to} ·{" "}
                      {new Date(rep.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reply */}
          {r.email ? (
            <div>
              <p className="mb-2 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                Reply to {r.email}
              </p>
              <div className="mb-2 flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setMessage(t.text(r))}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 hover:text-white"
                  >
                    Start from: {t.label}
                  </button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Write your reply…"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 outline-none focus:border-[#3AFFD4]/50"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-neutral-600">
                  Their reply comes straight back to your email.
                </p>
                <button
                  type="button"
                  disabled={busy || !message.trim()}
                  onClick={async () => {
                    if (await call({ action: "reply", message }, `Sent to ${r.email}.`)) setMessage("");
                  }}
                  className="rounded-xl bg-[#39FF14] px-5 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {busy ? "Sending…" : "Send reply"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No email on this request, so there&apos;s no way to reply.</p>
          )}

          {note && (
            <p className={`text-sm ${note.ok ? "text-[#39FF14]" : "text-[#FF5C3A]"}`}>{note.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
