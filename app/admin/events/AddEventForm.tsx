"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Manual add for the events nobody's API knows about.
//
// Ticketmaster and SeatGeek only index events sold through a box office. The
// festivals this scene actually runs on — the ones that surface on Radiate, on
// a flyer, or by word of mouth — sell through their own site or don't sell
// tickets at all, so no amount of discovery will ever find them. Karnival of
// the Arts had to be entered by hand for exactly this reason. This is that
// path, made repeatable.

type Fields = {
  name: string;
  venue: string;
  city: string;
  region: string;
  start_date: string;
  end_date: string;
  lat: string;
  lng: string;
  description: string;
  source_url: string;
};

const EMPTY: Fields = {
  name: "",
  venue: "",
  city: "",
  region: "PA",
  start_date: "",
  end_date: "",
  lat: "",
  lng: "",
  description: "",
  source_url: "",
};

export function AddEventForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Fields>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof Fields, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!f.name.trim()) return setError("Name is required.");
    if (!f.start_date) return setError("A start date is required — without one it can't be sorted or archived.");
    if (f.end_date && f.end_date < f.start_date) return setError("The end date is before the start date.");

    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/local-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...f }),
    });
    const r = await res.json().catch(() => ({}));
    setBusy(false);

    if (!r?.ok) {
      // The unique index on (name, city, start_date) surfaces here as a
      // constraint error — say what it means rather than leaking raw Postgres.
      setError(
        /duplicate key|unique/i.test(String(r?.error ?? ""))
          ? "That event is already listed — check the sections below."
          : r?.error || "Could not save."
      );
      return;
    }
    setF(EMPTY);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[#CC00FF]/30 px-4 py-2 font-dm-mono text-xs uppercase tracking-widest text-[#CC00FF] transition hover:bg-[#CC00FF]/10"
      >
        + Add an event by hand
      </button>
    );
  }

  const text = (key: keyof Fields, label: string, type = "text", placeholder = "") => (
    <div>
      <label className="mb-1.5 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">
        {label}
      </label>
      <input
        type={type}
        value={f[key]}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#CC00FF]/40 focus:outline-none"
      />
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-bebas text-2xl tracking-wide">Add an event</h3>
        <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white">
          ✕
        </button>
      </div>
      <p className="mb-5 text-sm text-neutral-500">
        For festivals the ticketing APIs will never see — anything you spot on Radiate, on a flyer,
        or by word of mouth. Goes live on <span className="text-neutral-300">/events</span>{" "}
        immediately, and archives itself once it&apos;s over.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{text("name", "Event name *", "text", "Karnival of the Arts")}</div>
        {text("venue", "Venue", "text", "Kempton Community Center")}
        {text("city", "City", "text", "Kempton")}
        {text("region", "State")}
        {text("source_url", "Link", "url", "https://…")}
        {text("start_date", "Starts *", "date")}
        {text("end_date", "Ends", "date")}
        {text("lat", "Latitude", "text", "40.6087")}
        {text("lng", "Longitude", "text", "-75.8571")}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">
            Description
          </label>
          <textarea
            value={f.description}
            rows={3}
            onChange={(e) => set("description", e.target.value)}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 focus:border-[#CC00FF]/40 focus:outline-none"
          />
        </div>
      </div>

      <p className="mt-3 font-dm-mono text-[11px] text-neutral-600">
        Latitude and longitude are optional, but without them the card shows no weather strip.
      </p>

      {error && <p className="mt-3 text-sm text-[#FF5C3A]">{error}</p>}

      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={() => setOpen(false)}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-xl bg-[#CC00FF] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add event"}
        </button>
      </div>
    </div>
  );
}
