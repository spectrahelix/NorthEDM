"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    // Listen for the PASSWORD_RECOVERY event — Supabase fires this when the
    // user arrives via the reset link and the access token in the hash is valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check if a session already exists (e.g. user refreshed the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3AFFD4]/10 text-2xl text-[#3AFFD4]">
            ✓
          </div>
          <h1 className="font-bebas text-3xl tracking-wide text-white">Password updated</h1>
          <p className="mt-3 text-sm text-neutral-400">Redirecting you to login…</p>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="font-dm-mono text-sm uppercase tracking-widest text-neutral-500">
            Verifying reset link…
          </p>
          <p className="mt-4 text-sm text-neutral-500">
            If nothing happens,{" "}
            <Link href="/forgot-password" className="text-[#3AFFD4] hover:underline">
              request a new link
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-bebas text-4xl tracking-[0.15em] text-white">NorthEDM</p>
          <p className="mt-1 font-dm-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
            New Password
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
          <h1 className="mb-1 font-bebas text-3xl tracking-wide text-white">Create a new password</h1>
          <p className="mb-7 text-sm text-neutral-400">Choose something strong and memorable.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                New Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="New password"
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

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Confirm New Password
              </label>
              <input
                name="confirm"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Repeat new password"
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
              className="w-full rounded-xl bg-[#E8FF47] py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
