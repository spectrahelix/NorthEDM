import Link from "next/link";
import type { Metadata } from "next";
import { WeatherStrip } from "../../components/WeatherStrip";

export const metadata: Metadata = {
  title: "Elements Festival 2026",
  description:
    "Elements Music & Arts Festival 2026 — Aug 7–9 at Pocono Raceway, Long Pond, PA. The Northeast's premier boutique EDM festival with car camping, art installations, and 3D projection mapping.",
};

const EVENT = {
  name: "Elements Music & Arts Festival",
  year: "2026",
  subtitle: "Music · Art · Camping · Community",
  location: "Pocono Raceway, Long Pond, PA",
  dates: "Friday Aug 7 – Sunday Aug 9, 2026",
  lat: 41.0559,
  lng: -75.5103,
  ticket_status: "available",
  badge: "hot",
  description:
    "Elements Music & Arts Festival is the Northeast's premier boutique electronic music festival — an immersive three-day car camping experience held annually at the iconic Pocono Raceway in Long Pond, Pennsylvania. The 2026 edition blends underground electronic music with large-scale art installations, wellness programming, and 3D video projection mapping into an independent, community-driven gathering unlike anything else in the region.",
  highlights: [
    "Three days of car camping in the Pocono Mountains",
    "Electronic music across multiple curated stages",
    "Large-scale interactive art installations",
    "3D video projection mapping",
    "Wellness programming and activities",
    "Independent, boutique festival experience",
    "Pocono Raceway, Long Pond, PA",
  ],
  website: "https://www.elementsfest.us",
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
            <h1 className="font-bebas text-[clamp(2.2rem,7vw,4.5rem)] leading-none tracking-wide">
              Elements Music &amp; Arts Festival
            </h1>
            <p className="mt-1 font-bebas text-2xl tracking-widest text-[#3AFFD4]">
              2026
            </p>
            <p className="mt-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
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
          <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">Forecast at Pocono Raceway</p>
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
            Official Site &amp; Tickets →
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
