"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import type { UserProfile } from "@/utils/supabase/user-profiles";

export function ComposeModal({
  userId,
  prefilledTo,
  onClose,
  onSent,
}: {
  userId: string;
  prefilledTo?: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [toQuery, setToQuery] = useState("");
  const [toResults, setToResults] = useState<UserProfile[]>([]);
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  // Prefill recipient if provided
  useEffect(() => {
    if (!prefilledTo) return;
    const supabase = createClient();
    supabase
      .from("user_profiles")
      .select("*")
      .eq("id", prefilledTo)
      .single()
      .then(({ data }) => {
        if (data) setRecipient(data as UserProfile);
      });
  }, [prefilledTo]);

  async function searchUsers(q: string) {
    if (!q.trim() || q.trim().length < 2) {
      setToResults([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("display_name", `%${q.trim()}%`)
      .neq("id", userId)
      .limit(6);
    setToResults((data ?? []) as UserProfile[]);
  }

  function onToInput(val: string) {
    setToQuery(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => searchUsers(val), 250);
  }

  async function send() {
    if (!recipient) {
      setError("Please select a recipient.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }
    setSending(true);
    setError("");
    const supabase = createClient();
    const { error: sendError } = await supabase.from("direct_messages").insert({
      sender_id: userId,
      recipient_id: recipient.id,
      subject: subject.trim(),
      body: body.trim(),
    });
    if (sendError) {
      setError(sendError.message);
      setSending(false);
      return;
    }
    // Notify recipient
    await supabase.from("notifications").insert({
      user_id: recipient.id,
      type: "message",
      message: `New message from ${(await supabase.from("user_profiles").select("display_name").eq("id", userId).single()).data?.display_name ?? "someone"}: ${subject.trim()}`,
      link: "/messages",
    });
    setSending(false);
    onSent();
  }

  const recipientInitials = recipient?.display_name.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-bebas text-3xl tracking-wide">New Message</h2>
          <button onClick={onClose} className="text-xl text-neutral-500 transition hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* To field */}
          <div className="relative">
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              To
            </label>
            {recipient ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3AFFD4]/10 font-dm-mono text-xs text-[#3AFFD4]">
                  {recipientInitials}
                </div>
                <span className="text-sm text-neutral-100">{recipient.display_name}</span>
                <button
                  onClick={() => { setRecipient(null); setToQuery(""); }}
                  className="ml-auto text-neutral-600 hover:text-white"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={toQuery}
                  onChange={(e) => onToInput(e.target.value)}
                  placeholder="Search by display name…"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                />
                {toResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-neutral-800 shadow-xl">
                    {toResults.map((p) => {
                      const ini = p.display_name.slice(0, 2).toUpperCase();
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setRecipient(p);
                            setToQuery("");
                            setToResults([]);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/5"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3AFFD4]/10 font-dm-mono text-xs text-[#3AFFD4]">
                            {ini}
                          </div>
                          <div>
                            <span className="text-sm text-neutral-100">{p.display_name}</span>
                            <span className="ml-2 font-dm-mono text-[10px] uppercase text-neutral-600">
                              {p.role}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
              placeholder="What's this about?"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Write your message…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-400 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={sending}
              className="rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send Message"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
