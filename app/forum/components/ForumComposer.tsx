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
    return null; // fail open on network error
  }
}

export function ForumComposer({
  user,
  categories,
  profileUsername,
}: {
  user: User | null;
  categories: string[];
  profileUsername: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"username" | "post">("post");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [savedUsername, setSavedUsername] = useState(profileUsername);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function openModal() {
    if (!user) {
      router.push("/login");
      return;
    }
    setStep(savedUsername ? "post" : "username");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setTitle("");
    setBody("");
    setError("");
    setUsernameInput("");
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
      setError("That username is taken. Try another.");
      setSubmitting(false);
      return;
    }

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: user!.id, role: "user", username: val });

    setSubmitting(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setSavedUsername(val);
    setStep("post");
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setError("");
    setSubmitting(true);

    const moderationError = await moderate(`${title}\n\n${body}`);
    if (moderationError) {
      setError(moderationError);
      setSubmitting(false);
      return;
    }

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
        className="shrink-0 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
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
              <h2 className="font-bebas text-3xl tracking-wide">
                {step === "username" ? "Choose your alias" : "New Thread"}
              </h2>
              <button onClick={close} className="text-xl text-neutral-500 transition hover:text-white">
                ✕
              </button>
            </div>

            {step === "username" ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-400">
                  Pick a username — this is how you'll appear in the community forum.
                </p>
                <div>
                  <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                    Username
                  </label>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }}
                    placeholder="your_alias"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                  />
                  <p className="mt-1.5 font-dm-mono text-xs text-neutral-600">
                    2–20 chars · letters, numbers, underscores
                  </p>
                </div>
                {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}
                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={close} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-400 transition hover:text-white">
                    Cancel
                  </button>
                  <button
                    onClick={saveUsername}
                    disabled={submitting}
                    className="rounded-xl bg-[#3AFFD4] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Set Username"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {savedUsername && (
                  <p className="font-dm-mono text-xs text-neutral-500">
                    Posting as <span className="text-[#3AFFD4]">@{savedUsername}</span>
                  </p>
                )}
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
                      <option key={c} value={c}>{c}</option>
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

                {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}

                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={close} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-400 transition hover:text-white">
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Checking…" : "Post Thread"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
