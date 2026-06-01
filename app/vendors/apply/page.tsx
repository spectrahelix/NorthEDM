"use client";

import { useState } from "react";

export default function VendorApplyPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
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
              email: formData.get("email"),
              category: formData.get("category"),
              description: formData.get("description"),
              capacity: formData.get("capacity"),
              public: formData.get("public"),
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
          <input
            name="name"
            placeholder="Name"
            required
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          />

          <input
            name="email"
            placeholder="Email"
            required
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          />

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
            name="capacity"
            placeholder="Capacity (low, medium, high)"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          />

          <select
            name="public"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          >
            <option value="false">Private Supplier</option>
            <option value="true">Public Vendor</option>
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