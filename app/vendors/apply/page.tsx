"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function VendorApplyPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  // Captured at mount — used as a timing trap against instant bot submits.
  const [loadedAt] = useState(() => Date.now());
  // Pre-fill the personal email from the signed-in account. That address is
  // what links an approved vendor to the person who runs it, so the closer it
  // starts to their real login the fewer approvals end up with nobody to
  // connect to.
  const [personalEmail, setPersonalEmail] = useState("");
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const e = data.user?.email ?? null;
        setSignedInAs(e);
        if (e) setPersonalEmail((cur) => cur || e);
      });
  }, []);

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Vendor Application
        </p>

        <h1 className="mt-3 text-5xl font-semibold">
          Apply to Join NorthEDM
        </h1>

        <p className="mt-4 text-neutral-300">
          Tell us what you offer and how you'd like to participate in the
          ecosystem.
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsSubmitting(true);
            setMessage("");

            const form = e.target as HTMLFormElement;
            const formData = new FormData(form);

            const data = {
              name: formData.get("name"),
              personalEmail: formData.get("personalEmail"),
              businessEmail: formData.get("businessEmail"),
              category: formData.get("category"),
              description: formData.get("description"),
              website: formData.get("website"),
              capacity: formData.get("capacity"),
              public: formData.get("public"),
              // Anti-spam: honeypot (should stay empty) + time-to-submit.
              company_website: formData.get("company_website"),
              elapsedMs: Date.now() - loadedAt,
            };

            try {
              const res = await fetch("/api/vendors", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
              });

              const result = await res.json();

              if (res.ok) {
                setMessage("Application submitted successfully.");
                form.reset();
              } else {
                setMessage(result.error || "Something went wrong.");
              }
            } catch (err) {
              setMessage("Something went wrong.");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
        >
          {/* Honeypot — hidden from people, irresistible to bots. If filled,
              the server silently drops the submission. */}
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          <input
            name="name"
            placeholder="Business or brand name"
            required
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          />

          <div>
            <input
              name="personalEmail"
              type="email"
              placeholder="Your personal email"
              required
              autoComplete="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            />
            <p className="mt-1.5 px-1 text-xs text-neutral-500">
              {signedInAs
                ? "This is the email you're signed in with — approval gives this account your vendor dashboard."
                : "Use the email you sign in to NorthEDM with. When you're approved, that account gets your vendor dashboard."}
            </p>
          </div>

          <div>
            <input
              name="businessEmail"
              type="email"
              placeholder="Business email (optional)"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            />
            <p className="mt-1.5 px-1 text-xs text-neutral-500">
              Where customers can reach your business, if it&apos;s different.
            </p>
          </div>

          <input
            name="category"
            placeholder="Category (mushrooms, art, services, etc.)"
            required
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          />

          <textarea
            name="description"
            placeholder="What do you offer?"
            required
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          />

          <input
            name="website"
            type="url"
            inputMode="url"
            placeholder="Website (optional) — e.g. yourshop.com"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          />

          <input
            name="capacity"
            placeholder="Capacity (low, medium, high)"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          />

          <p className="-mb-1 px-1 text-xs text-neutral-500">
            How would you like to be listed? We&apos;ll confirm this when your
            application is reviewed.
          </p>
          <select
            name="public"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          >
            <option value="false">Private Supplier — not listed publicly</option>
            <option value="true">Public Vendor — list me in the directory</option>
          </select>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-green-400 px-6 py-3 font-medium text-black"
          >
            {isSubmitting ? "Submitting..." : "Apply"}
          </button>

          {message && <p className="text-green-300">{message}</p>}
        </form>
      </div>
    </main>
  );
}