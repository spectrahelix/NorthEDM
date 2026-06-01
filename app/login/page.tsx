"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage("");

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/admin/bookings");
    router.refresh();
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Login
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Sign in to NorthEDM</h1>
        <p className="mt-4 text-neutral-300">
          Access your account, bookings, and future admin tools.
        </p>

        <form action={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-neutral-300">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-neutral-300">Password</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-green-400 px-6 py-3 font-medium text-black disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {message ? <p className="text-sm text-red-300">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}