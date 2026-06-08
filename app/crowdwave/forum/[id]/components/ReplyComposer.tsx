"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

export function ReplyComposer({
  threadId,
  user,
}: {
  threadId: number;
  user: User | null;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-6 text-center">
        <p className="mb-3 text-sm text-neutral-400">
          Sign in to join the conversation.
        </p>
        <a
          href="/login"
          className="inline-block rounded-xl bg-[#E8FF47] px-5 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          Log in to reply
        </a>
      </div>
    );
  }

  async function submit() {
    if (!body.trim()) return;
    setError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("replies").insert({
      thread_id: threadId,
      user_id: user!.id,
      body: body.trim(),
    });
    setSubmitting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setBody("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
        Add a Reply
      </p>
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
          {submitting ? "Posting…" : "Post Reply"}
        </button>
      </div>
    </div>
  );
}
