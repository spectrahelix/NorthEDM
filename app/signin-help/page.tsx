"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// The one page a locked-out guest can use. No account required — that's the
// whole point; see app/api/signin-help/route.ts.

export default function SigninHelpPage() {
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // When this page was opened. The server rejects a submission that arrives
  // faster than anyone could have read the form — the cheapest signal against
  // the crawlers that walk this site's forms, and one that costs a real person
  // nothing. A ref, not state, so it is set once and never triggers a render.
  //
  // Stamped in an effect rather than as useRef(Date.now()): reading the clock
  // during render is impure, and React's own lint rule rejects it. If the
  // effect somehow hasn't run we send no timing at all, and the server treats
  // an absent value as "no opinion" rather than as a rejection.
  const openedAt = useRef<number | null>(null);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);

    const res = await fetch("/api/signin-help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        description,
        website,
        elapsedMs: openedAt.current === null ? undefined : Date.now() - openedAt.current,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(json.error || "Couldn't send that. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3AFFD4]/10 text-2xl text-[#3AFFD4]">
            ✓
          </div>
          <h1 className="font-bebas text-3xl tracking-wide text-white">Message sent</h1>
          <p className="mt-3 text-sm text-neutral-400">
            We got it, and we&apos;ll email <span className="text-neutral-200">{email}</span> directly.
            You don&apos;t need to do anything else.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl border border-white/10 px-6 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white"
          >
            Back to NorthEDM
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
          <h1 className="mb-1 font-bebas text-3xl tracking-wide text-white">Trouble signing in?</h1>
          <p className="mb-7 text-sm text-neutral-400">
            Tell us your email and what&apos;s going wrong. This goes straight to a person — you
            don&apos;t need an account to send it.
          </p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Your email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-[#3AFFD4]/50 focus:ring-1 focus:ring-[#3AFFD4]/20"
              />
              <p className="mt-1.5 font-dm-mono text-xs text-neutral-600">
                The address you signed up with, if you know it.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                What&apos;s happening? <span className="text-neutral-600">(optional)</span>
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. never got the confirmation email, or the password reset link doesn't work"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-[#3AFFD4]/50 focus:ring-1 focus:ring-[#3AFFD4]/20"
              />
            </div>

            {/* Honeypot — hidden from people, irresistible to form-fillers. */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-lg border border-[#FF5C3A]/20 bg-[#FF5C3A]/10 px-4 py-2.5 text-sm text-[#FF5C3A]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-xl bg-[#39FF14] py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send it"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Just forgot your password?{" "}
          <Link href="/forgot-password" className="text-[#3AFFD4] transition hover:opacity-80">
            Reset it here
          </Link>
        </p>
      </div>
    </main>
  );
}
