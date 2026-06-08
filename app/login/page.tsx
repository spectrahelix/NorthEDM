"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Wrong email or password. Try again or reset your password."
          : authError.message
      );
      setLoading(false);
      return;
    }

    router.push("/feed");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-16">
      <div className="w-full max-w-md">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <p className="font-bebas text-4xl tracking-[0.15em] text-white">NorthEDM</p>
          <p className="mt-1 font-dm-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
            Community Platform
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
          <h1 className="mb-1 font-bebas text-3xl tracking-wide text-white">Welcome back</h1>
          <p className="mb-7 text-sm text-neutral-400">
            Sign in to post, reply, and connect with the community.
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

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="font-dm-mono text-xs text-[#3AFFD4]/70 transition hover:text-[#3AFFD4]"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 pr-16 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-[#3AFFD4]/50 focus:ring-1 focus:ring-[#3AFFD4]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 font-dm-mono text-xs text-neutral-500 transition hover:text-neutral-300"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-[#FF5C3A]/20 bg-[#FF5C3A]/10 px-4 py-2.5 text-sm text-[#FF5C3A]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#E8FF47] py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          New to NorthEDM?{" "}
          <Link href="/signup" className="text-[#E8FF47] transition hover:opacity-80">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}