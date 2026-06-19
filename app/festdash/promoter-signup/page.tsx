"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function FestDashPromoterSignup() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    audience: "",
    promoteVendor: "",
    why: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setForm((f) => ({ ...f, email: f.email || user.email! }));
    });
  }, [supabase]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/festdash/promoter-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">📣</div>
          <h1 className="mb-3 font-bebas text-4xl tracking-wide text-white">
            Application received!
          </h1>
          <p className="mb-6 text-neutral-400">
            Thanks for wanting to spread the word. We&apos;ll review your
            application and, once you&apos;re approved, you&apos;ll get
            one-time promo codes to share with your people.
          </p>
          <button
            onClick={() => router.push("/festdash")}
            className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-400"
          >
            Back to FestDash
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-orange-400">
          FestDash Promoter Program
        </div>
        <h1 className="mb-2 font-bebas text-5xl tracking-wide text-white">
          Become a Promoter
        </h1>
        <p className="mb-10 text-neutral-500">
          Send people to your favorite FestDash vendors with one-time discount
          codes. Earn a commission on every order your codes bring in — and
          level up your rank on the network.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Your Name *
              </label>
              <input
                required
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="How people know you"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Email *
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Phone
            </label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
              placeholder="(555) 000-0000"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Which vendor or brand do you want to promote?
            </label>
            <input
              value={form.promoteVendor}
              onChange={(e) => set("promoteVendor", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
              placeholder="Homestead Life, a specific vendor, the whole network..."
            />
          </div>

          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              How do you reach people?
            </label>
            <input
              value={form.audience}
              onChange={(e) => set("audience", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
              placeholder="Instagram, festival crews, friend group, email list..."
            />
          </div>

          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Why would you be a great promoter?
            </label>
            <textarea
              rows={3}
              value={form.why}
              onChange={(e) => set("why", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
              placeholder="Tell us about your reach and the scene you're part of..."
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-orange-500 py-3.5 font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            {loading ? "Submitting…" : "Apply to Promote"}
          </button>
        </form>
      </div>
    </main>
  );
}
