import Link from "next/link";
import type { Metadata } from "next";
import { WeatherStrip } from "../../components/WeatherStrip";

export const metadata: Metadata = {
  title: "Elements Festival 2026",
  description:
    "Elements Music & Arts Festival 2026 — Aug 27–30 at Lake Harmony, PA. Tickets available. Northeast EDM's marquee summer gathering.",
};

const EVENT = {
  name: "Elements Festival 2026",
  subtitle: "Music · Arts · Community",
  location: "Lake Harmony, PA — Pocono Mountains",
  dates: "Thursday Aug 27 – Sunday Aug 30, 2026",
  lat: 41.0534,
  lng: -75.6052,
  ticket_status: "available",
  badge: "hot",
  description:
    "Elements is the Northeast's premier electronic music and arts festival, set against the backdrop of the Pocono Mountains. Four days of underground house, techno, bass, and ambient music across multiple stages, with immersive art installations, a vibrant vendor village, and a tight-knit community culture.",
  highlights: [
    "Multiple stages — forest, lakeside, and main",
    "Curated underground and live acts",
    "Art installations throughout the grounds",
    "Camping on-site",
    "Vendor village with food, art, and holistic goods",
  ],
  website: "https://elementsfestival.us",
};

export default function Elements2026Page() {
  return (
    <main className="min-h-screen text-neutral-100">
      {/* Back */}
      <div className="mx-auto max-w-4xl px-6 pt-10">
        <Link
          href="/crowdwave"
          className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600 transition hover:text-neutral-300"
        >
          ← CrowdWave
        </Link>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="mb-3 inline-block rounded-full bg-[#FF5C3A]/20 px-3 py-1 font-dm-mono text-xs uppercase tracking-widest text-[#FF5C3A]">
              hot
            </span>
            <h1 className="font-bebas text-[clamp(2.5rem,8vw,5rem)] leading-none tracking-wide">
              Elements Festival 2026
            </h1>
            <p className="mt-1 font-dm-mono text-xs uppercase tracking-widest text-[#3AFFD4]">
              {EVENT.subtitle}
            </p>
            <p className="mt-2 text-base text-neutral-400">{EVENT.location}</p>
          </div>
          <span className="shrink-0 rounded-full border border-[#3AFFD4]/40 px-4 py-1.5 font-dm-mono text-xs uppercase tracking-widest text-[#3AFFD4]">
            Tickets Available
          </span>
        </div>

        {/* Date */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">Dates</p>
          <p className="mt-1 text-base text-neutral-200">{EVENT.dates}</p>
        </div>

        {/* Weather */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
          <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">Forecast at Venue</p>
          <WeatherStrip lat={EVENT.lat} lng={EVENT.lng} />
        </div>

        {/* Description */}
        <div className="mt-4 rounded-2xl border border-[#3AFFD4]/15 bg-[#3AFFD4]/[0.03] px-6 py-5">
          <p className="text-sm leading-7 text-neutral-300">{EVENT.description}</p>
        </div>

        {/* Highlights */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">What to Expect</p>
          <ul className="space-y-2">
            {EVENT.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-neutral-300">
                <span className="mt-0.5 text-[#3AFFD4]">✦</span>
                {h}
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={EVENT.website}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[#3AFFD4] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Get Tickets →
          </a>
          <Link
            href="/crowdwave/forum"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Discuss on Forum
          </Link>
          <Link
            href="/crowdwave"
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-neutral-500 transition hover:text-neutral-300"
          >
            All Festivals
          </Link>
        </div>
      </section>
    </main>
  );
}
