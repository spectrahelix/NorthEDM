"use client";

import { useState } from "react";

const CATEGORIES = ["Bug", "Idea", "Praise", "Other"] as const;

export function FeedbackForm() {
  const [category, setCategory] = useState<string>("Bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) {
      setError("Please enter a bit more detail.");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, message, email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Something went wrong.");
      }
      setStatus("sent");
      setMessage("");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-8 rounded-2xl border border-[#39FF14]/30 bg-[#39FF14]/[0.05] p-8 text-center">
        <div className="text-4xl">🙏</div>
        <h2 className="mt-3 font-bebas text-3xl tracking-wide text-white">Thank you!</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Your feedback went straight to the team. It genuinely helps us launch NorthEDM.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-6 rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white transition hover:bg-white/5"
        >
          Send more feedback
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <div>
        <label className="mb-2 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          What kind of feedback?
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                category === c
                  ? "border-[#39FF14] bg-[#39FF14]/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-neutral-400 hover:bg-white/5"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="fb-message" className="mb-2 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Your feedback
        </label>
        <textarea
          id="fb-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="What worked, what broke, what you'd love to see…"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-[#39FF14]/50"
        />
      </div>

      <div>
        <label htmlFor="fb-email" className="mb-2 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Email <span className="text-neutral-600">(optional — if you want a reply)</span>
        </label>
        <input
          id="fb-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-[#39FF14]/50"
        />
      </div>

      {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-2xl bg-[#39FF14] px-6 py-4 text-base font-semibold text-black transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 sm:w-auto sm:px-10"
      >
        {status === "sending" ? "Sending…" : "Send Feedback"}
      </button>
    </form>
  );
}
