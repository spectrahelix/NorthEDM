"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const CATEGORIES = [
  "Mushrooms & Foraged", "Holistic & Wellness", "Art & Prints", "Crafts & Handmade",
  "Festival Gear", "Apparel", "Jewelry", "Food & Drink", "Workshops & Services", "Other",
];

export default function MarketplaceApplyPage() {
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "authwall">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (businessName.trim().length < 2) { setError("Please enter your business name."); return; }
    setStatus("sending"); setError("");

    // Must be logged in to apply.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("authwall"); return; }

    const res = await fetch("/api/marketplace/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessName, category, description, contact, website }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setStatus("error"); setError(j.error || "Something went wrong.");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
        <div className="max-w-md rounded-2xl border border-[#00D4FF]/30 bg-[#00D4FF]/[0.05] p-8 text-center">
          <div className="text-4xl">🏪</div>
          <h1 className="mt-3 font-bebas text-4xl tracking-wide">Application received!</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Thanks for applying for your own NorthEDM Marketplace. The team will review it and reach
            out. Once approved, you&apos;ll be able to upload your inventory from your Vendor Dashboard.
          </p>
          <Link href="/marketplace" className="mt-6 inline-block rounded-xl border border-white/15 px-6 py-2.5 text-sm text-neutral-200 transition hover:bg-white/5">
            Back to Marketplace
          </Link>
        </div>
      </main>
    );
  }

  if (status === "authwall") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="mt-3 font-bebas text-3xl tracking-wide">Log in to apply</h1>
          <p className="mt-2 text-sm text-neutral-400">You need a free NorthEDM account to apply for a Marketplace.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login" className="rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-black">Log In</Link>
            <Link href="/signup" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-neutral-200">Sign Up</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#00D4FF]">Marketplace</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Get Your Own NorthEDM Marketplace</h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Set up shop right inside NorthEDM — your own branded market page where customers browse and
          buy your inventory. Tell us about your business and we&apos;ll get you set up.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="Business / Shop name *">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={120}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 focus:outline-none" />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c0e] px-4 py-3 text-sm text-neutral-100 focus:outline-none">
              <option value="">Select…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="What do you sell / make?">
            <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 2000))} rows={4}
              placeholder="Tell us about your products, your story, and what you'd list…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Best contact (phone/email)">
              <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 focus:outline-none" />
            </Field>
            <Field label="Existing website / social (optional)">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} placeholder="https://…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
            </Field>
          </div>

          {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}

          <button type="submit" disabled={status === "sending"}
            className="w-full rounded-2xl bg-[#00D4FF] px-6 py-4 text-base font-semibold text-black transition hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-10">
            {status === "sending" ? "Submitting…" : "Submit Application"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{label}</label>
      {children}
    </div>
  );
}
