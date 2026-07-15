"use client";

import { useState } from "react";

export default function ForagingPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-green-300">
            NorthEDM Foraging
          </p>
          <h1 className="mt-3 text-5xl font-semibold">
            Book a Mushroom Foraging Experience
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-300">
            Guided mushroom walks, educational outings, culinary-focused
            exploration, and Appalachian woodland knowledge with a licensed
            forager.
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-green-400/20 bg-green-400/[0.05] px-5 py-3 text-sm">
            <span className="font-dm-mono text-xs uppercase tracking-widest text-green-300">Book direct</span>
            <span className="text-neutral-200">CJ Lewis</span>
            <a href="tel:+15709514219" className="text-neutral-200 hover:text-white">570-951-4219</a>
            <a href="mailto:cjblue27@gmail.com" className="text-neutral-200 hover:text-white">cjblue27@gmail.com</a>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">What this can include</h2>
            <ul className="mt-4 space-y-3 text-neutral-300">
              <li>• Beginner-friendly guided walks</li>
              <li>• Culinary mushroom education</li>
              <li>• Mushroom identification learning</li>
              <li>• Private or small-group experiences</li>
              <li>• Seasonal woodland exploration</li>
            </ul>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              setSuccessMessage("");

              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);

              const data = {
                name: formData.get("name"),
                email: formData.get("email"),
                groupSize: formData.get("groupSize"),
                date: formData.get("date"),
                notes: formData.get("notes"),
              };

              try {
                const res = await fetch("/api/booking", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(data),
                });

                const result = await res.json();
                console.log(result);

                if (res.ok) {
                  setSuccessMessage("Booking request sent successfully.");
                  form.reset();
                } else {
                  setSuccessMessage("Something went wrong. Please try again.");
                }
              } catch (error) {
                console.error(error);
                setSuccessMessage("Something went wrong. Please try again.");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-4"
          >
            <h2 className="text-2xl font-semibold">Booking Inquiry</h2>

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
                Group Size
              </label>
              <input
                name="groupSize"
                type="number"
                min="1"
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                placeholder="1, 2, 4, etc."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-300">
                Preferred Date
              </label>
              <input
                name="date"
                type="date"
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-300">
                Additional Notes
              </label>
              <textarea
                name="notes"
                className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                placeholder="Culinary mushrooms, beginner tour, private booking, etc."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-green-400 px-6 py-3 font-medium text-black disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send Booking Inquiry"}
            </button>

            {successMessage ? (
              <p className="text-sm text-green-300">{successMessage}</p>
            ) : null}
          </form>
        </div>
      </div>
    </main>
  );
}