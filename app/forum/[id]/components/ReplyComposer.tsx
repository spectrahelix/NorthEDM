"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;

async function moderate(content: string): Promise<string | null> {
  try {
    const res = await fetch("/api/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const json = await res.json();
    return json.allowed ? null : (json.reason ?? "Content not allowed.");
  } catch {
    return null;
  }
}

export function ReplyComposer({
  threadId,
  user,
  profileUsername,
}: {
  threadId: number;
  user: User | null;
  profileUsername: string | null;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [savedUsername, setSavedUsername] = useState(profileUsername);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-6 text-center">
        <p className="mb-3 text-sm text-neutral-400">Sign in to join the conversation.</p>
        <a
          href="/login"
          className="inline-block rounded-xl bg-[#E8FF47] px-5 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          Log in to reply
        </a>
      </div>
    );
  }

  async function saveUsername() {
    const val = usernameInput.trim();
    if (!USERNAME_RE.test(val)) {
      setError("2–20 chars, letters, numbers, underscores only.");
      return;
    }
    setError("");
    setSubmitting(true);
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", val)
      .maybeSingle();
    if (existing) {
      setError("That username is taken.");
      setSubmitting(false);
      return;
    }
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: user!.id, role: "user", username: val });
    setSubmitting(false);
    if (upsertError) { setError(upsertError.message); return; }
    setSavedUsername(val);
    setShowUsernameForm(false);
  }

  async function submit() {
    if (!body.trim()) return;
    if (!savedUsername) { setShowUsernameForm(true); return; }
    setError("");
    setSubmitting(true);

    const moderationError = await moderate(body);
    if (moderationError) {
      setError(moderationError);
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: dbError } = await supabase.from("replies").insert({
      thread_id: threadId,
      user_id: user!.id,
      body: body.trim(),
    });
    setSubmitting(false);
    if (dbError) { setError(dbError.message); return; }
    setBody("");
    startTransition(() => router.refresh());
  }

  if (showUsernameForm) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="mb-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Choose your alias first
        </p>
        <p className="mb-4 text-sm text-neutral-400">
          This is how you'll appear in the community.
        </p>
        <input
          type="text"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }}
          placeholder="your_alias"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
        />
        <p className="mt-1.5 font-dm-mono text-xs text-neutral-600">2–20 chars · letters, numbers, underscores</p>
        {error && <p className="mt-2 text-sm text-[#FF5C3A]">{error}</p>}
        <div className="mt-3 flex gap-3 justify-end">
          <button onClick={() => setShowUsernameForm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={saveUsername}
            disabled={submitting}
            className="rounded-xl bg-[#3AFFD4] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Set Username"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Add a Reply</p>
        {savedUsername ? (
          <span className="font-dm-mono text-xs text-neutral-600">
            as <span className="text-[#3AFFD4]">@{savedUsername}</span>
          </span>
        ) : (
          <button
            onClick={() => setShowUsernameForm(true)}
            className="font-dm-mono text-xs text-[#3AFFD4]/70 hover:text-[#3AFFD4]"
          >
            Set alias
          </button>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Share your thoughts…"
        className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-[#FF5C3A]">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          onClick={submit}
          disabled={submitting || !body.trim()}
          className="rounded-xl bg-[#E8FF47] px-5 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Post Reply"}
        </button>
      </div>
    </div>
  );
}
