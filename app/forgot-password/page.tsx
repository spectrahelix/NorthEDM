"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3AFFD4]/10 text-2xl text-[#3AFFD4]">
            ✉
          </div>
          <h1 className="font-bebas text-3xl tracking-wide text-white">Email sent</h1>
          <p className="mt-3 text-sm text-neutral-400">
            If that email is registered, you'll receive a password reset link shortly. Check your spam folder too.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-block rounded-xl bg-[#39FF14] px-6 py-3 font-semibold text-black transition hover:opacity-90"
          >
            Back to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-bebas text-4xl tracking-[0.15em] text-white">NorthEDM</p>
          <p className="mt-1 font-dm-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
            Password Reset
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
          <h1 className="mb-1 font-bebas text-3xl tracking-wide text-white">Reset your password</h1>
          <p className="mb-7 text-sm text-neutral-400">
            Enter your email and we'll send you a link to create a new password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-[#3AFFD4]/50 focus:ring-1 focus:ring-[#3AFFD4]/20"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-[#FF5C3A]/20 bg-[#FF5C3A]/10 px-4 py-2.5 text-sm text-[#FF5C3A]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#39FF14] py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Remember your password?{" "}
          <Link href="/login" className="text-[#3AFFD4] transition hover:opacity-80">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
