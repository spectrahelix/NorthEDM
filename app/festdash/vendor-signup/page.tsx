"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FestDashVendorSignup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    productTypes: "",
    typicalEvents: "",
    hasTablet: "",
    notes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/festdash/vendor-signup", {
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
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">🎪</div>
          <h1 className="mb-3 font-bebas text-4xl tracking-wide text-white">
            You&apos;re in the network!
          </h1>
          <p className="mb-6 text-neutral-400">
            Welcome to FestDash. We&apos;ll review your application and reach out to
            get you set up before your next event.
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
    <main className="min-h-screen bg-neutral-950 px-6 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-orange-400">
          FestDash Vendor Network
        </div>
        <h1 className="mb-2 font-bebas text-5xl tracking-wide text-white">
          Join FestDash
        </h1>
        <p className="mb-10 text-neutral-500">
          Add delivery to your vending setup. Orders come straight to your
          tablet — no extra hardware required.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Business Name *
              </label>
              <input
                required
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="Homestead Life"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Contact Name *
              </label>
              <input
                required
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
                placeholder="Brandi Martenas"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
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
          </div>

          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              What do you sell? *
            </label>
            <input
              required
              value={form.productTypes}
              onChange={(e) => set("productTypes", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
              placeholder="Herbal salves, mushroom products, crystals..."
            />
          </div>

          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Events you typically attend
            </label>
            <input
              value={form.typicalEvents}
              onChange={(e) => set("typicalEvents", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
              placeholder="Elements, Rootwire, local markets..."
            />
          </div>

          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Do you use a tablet for transactions?
            </label>
            <select
              value={form.hasTablet}
              onChange={(e) => set("hasTablet", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:outline-none"
            >
              <option value="">Select...</option>
              <option value="yes">Yes — I use a tablet at events</option>
              <option value="phone">I use my phone</option>
              <option value="no">No, but I&apos;m interested in getting one</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Anything else?
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none"
              placeholder="Questions, special setup notes, upcoming events..."
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
            {loading ? "Submitting…" : "Join the FestDash Network"}
          </button>
        </form>
      </div>
    </main>
  );
}
