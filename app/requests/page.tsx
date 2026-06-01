"use client";

import { useState } from "react";

export default function RequestsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-green-300">
            NorthEDM Requests
          </p>
          <h1 className="mt-3 text-5xl font-semibold">Submit a Work Request</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-300">
            Need help with a tech issue, custom job, creative task, or another
            service? Submit your request and we’ll review it, quote it, and
            coordinate next steps.
          </p>
        </div>

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
              serviceType: formData.get("serviceType"),
              description: formData.get("description"),
              urgency: formData.get("urgency"),
              budget: formData.get("budget"),
            };

            try {
              const res = await fetch("/api/requests", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
              });

              const result = await res.json();
              console.log(result);

              if (res.ok) {
                setMessage("Request submitted successfully.");
                form.reset();
              } else {
                setMessage("Something went wrong. Please try again.");
              }
            } catch (error) {
              console.error(error);
              setMessage("Something went wrong. Please try again.");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm text-neutral-300">
              Full Name
            </label>
            <input
              name="name"
              type="text"
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-neutral-300">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-neutral-300">
              Service Type
            </label>
            <input
              name="serviceType"
              type="text"
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="Tech help, repair, creative work, consulting, etc."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-neutral-300">
              Description
            </label>
            <textarea
              name="description"
              required
              className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="Describe the issue or work request."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-neutral-300">
              Urgency
            </label>
            <input
              name="urgency"
              type="text"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="Low, medium, high, ASAP, etc."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-neutral-300">
              Budget
            </label>
            <input
              name="budget"
              type="text"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              placeholder="Optional budget or price expectation"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-green-400 px-6 py-3 font-medium text-black disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Submit Request"}
          </button>

          {message ? <p className="text-sm text-green-300">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}