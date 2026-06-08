"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

export function ForumComposer({
  user,
  categories,
}: {
  user: User | null;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function openModal() {
    if (!user) {
      router.push("/login");
      return;
    }
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setTitle("");
    setBody("");
    setError("");
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("threads").insert({
      user_id: user!.id,
      category,
      title: title.trim(),
      body: body.trim(),
      reply_count: 0,
      heart_count: 0,
    });
    setSubmitting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    close();
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        onClick={openModal}
        className="shrink-0 rounded-xl bg-[#E8FF47] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
      >
        + New Post
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-bebas text-3xl tracking-wide">New Thread</h2>
              <button
                onClick={close}
                className="text-xl text-neutral-500 transition hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 focus:border-[#3AFFD4]/40 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's the thread about?"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Share your thoughts…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                />
              </div>

              {error && (
                <p className="text-sm text-[#FF5C3A]">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={close}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-400 transition hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-xl bg-[#E8FF47] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Posting…" : "Post Thread"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
