"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { SocialAuth } from "@/app/components/SocialAuth";

const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  const strength =
    password.length === 0
      ? 0
      : password.length < 6
      ? 1
      : password.length < 10
      ? 2
      : /[A-Z]/.test(password) && /[0-9]/.test(password)
      ? 4
      : 3;

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-[#FF5C3A]", "bg-orange-400", "bg-[#E8FF47]", "bg-[#3AFFD4]"][strength];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const username = String(fd.get("username") || "").trim();
    const pw = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");

    if (!USERNAME_RE.test(username)) {
      setError("Username must be 2–20 characters, letters, numbers, and underscores only.");
      setLoading(false);
      return;
    }
    if (pw.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }
    if (pw !== confirm) {
      setError("Passwords don't match.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Check username availability before signing up
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      setError("That username is taken. Try another.");
      setLoading(false);
      return;
    }

    const { data: signupData, error: signupError } = await supabase.auth.signUp({ email, password: pw });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    // Upsert profile with username right away
    if (signupData.user) {
      await supabase.from("profiles").upsert({
        id: signupData.user.id,
        role: "user",
        username,
      });
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3AFFD4]/10 text-2xl text-[#3AFFD4]">
            ✓
          </div>
          <h1 className="font-bebas text-3xl tracking-wide text-white">Check your inbox</h1>
          <p className="mt-3 text-sm text-neutral-400">
            We sent a confirmation link to your email. Click it to activate your account, then come back and log in.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-block rounded-xl bg-[#E8FF47] px-6 py-3 font-semibold text-black transition hover:opacity-90"
          >
            Back to Login
          </Link>
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
            Community Platform
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
          <h1 className="mb-1 font-bebas text-3xl tracking-wide text-white">Join the community</h1>
          <p className="mb-7 text-sm text-neutral-400">
            Your account is your identity across bookings, the marketplace, and the forum.
          </p>

          <SocialAuth next="/profile/edit" />

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Username
              </label>
              <input
                name="username"
                type="text"
                required
                autoComplete="username"
                placeholder="your_alias"
                pattern="[a-zA-Z0-9_]{2,20}"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-[#3AFFD4]/50 focus:ring-1 focus:ring-[#3AFFD4]/20"
              />
              <p className="mt-1.5 font-dm-mono text-xs text-neutral-600">
                2–20 chars · letters, numbers, underscores · shown in the forum
              </p>
            </div>

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
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i <= strength ? strengthColor : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-dm-mono text-xs text-neutral-500">{strengthLabel}</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Confirm Password
              </label>
              <input
                name="confirm"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Repeat your password"
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
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="text-[#E8FF47] transition hover:opacity-80">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}