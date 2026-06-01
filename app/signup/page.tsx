"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage("");

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Signup successful. Check your email to confirm your account.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Account Signup
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Create your NorthEDM account</h1>
        <p className="mt-4 text-neutral-300">
          Join the NorthEDM ecosystem for bookings, future marketplace access,
          community identity, and Wook World features.
        </p>

        <form
          action={handleSubmit}
          className="mt-8 space-y-4"
        >
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
              placeholder="Create a password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-green-400 px-6 py-3 font-medium text-black disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          {message ? <p className="text-sm text-green-300">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}