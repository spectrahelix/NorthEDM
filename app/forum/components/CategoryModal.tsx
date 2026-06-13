"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const EMOJI_OPTIONS = [
  "🌿","🍄","🌲","🌊","🔥","⚡","🌙","⭐","🎶","🎸",
  "🏕️","🚗","🎟️","🔮","🌧️","❄️","☀️","🌺","🦋","🐺",
  "🦅","🌾","🍃","🌵","🗺️","🧭","🎨","📸","🎭","🛸",
  "🌈","🪐","🔭","🧬","🌋","🏔️","🐉","🦌","🌑","✨",
];

export function CategoryModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🌿");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    setOpen(false);
    setName("");
    setDescription("");
    setIcon("🌿");
    setError("");
  }

  async function submit() {
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    if (name.trim().length > 40) {
      setError("Name must be 40 characters or less.");
      return;
    }
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: dbError } = await supabase.from("forum_categories").insert({
      name: name.trim(),
      description: description.trim(),
      icon,
      created_by: userId,
      is_default: false,
    });
    setSubmitting(false);
    if (dbError) {
      if (dbError.code === "23505") {
        setError("A category with that name already exists.");
      } else {
        setError(dbError.message);
      }
      return;
    }
    close();
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-600 transition hover:bg-white/5 hover:text-neutral-400"
      >
        + Create Category
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bebas text-3xl tracking-wide">
                New Category
              </h2>
              <button
                onClick={close}
                className="text-xl text-neutral-500 transition hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Icon picker */}
              <div>
                <label className="mb-2 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setIcon(emoji)}
                      className={`rounded-lg p-2 text-lg transition ${
                        icon === emoji
                          ? "bg-[#E8FF47]/10 ring-1 ring-[#E8FF47]/30"
                          : "hover:bg-white/5"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Sunrise Sessions"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Description{" "}
                  <span className="normal-case tracking-normal text-neutral-700">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={120}
                  placeholder="What's this category for?"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
                />
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600 mb-1">
                  Preview
                </p>
                <p className="text-sm text-neutral-300">
                  <span className="mr-2">{icon}</span>
                  {name || "Category Name"}
                </p>
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
                  className="rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Create Category"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
