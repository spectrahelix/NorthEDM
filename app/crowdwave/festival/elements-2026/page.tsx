import Link from "next/link";
import type { Metadata } from "next";
import { WeatherStrip } from "../../components/WeatherStrip";

export const metadata: Metadata = {
  title: "Elements Festival 2026",
  description:
    "Elements Music & Arts Festival 2026 — Aug 7–9 at Pocono Raceway, Long Pond, PA. Porter Robinson, Charlotte de Witte, Above & Beyond, Excision, Clozee, GRiZ and more.",
};

const LINEUP: { day: string; headliners: string[]; supporting: string[] }[] = [
  {
    day: "Thursday · Aug 7",
    headliners: ["Chris Lorenzo", "Mersiv", "Wankdat"],
    supporting: ["Ardalan", "Austeria B2B Sharlitz Web", "Saka x Fly", "San Pacho", "Jack What?", "Sunni D"],
  },
  {
    day: "Friday · Aug 8",
    headliners: ["Above & Beyond", "Atliens", "Big Gigantic", "Boys Noize", "Chris Lake", "Excision", "Ganja White Night"],
    supporting: ["Crankdat", "It's Murph", "Jigitz", "Kettama", "Mersiv", "Mickman", "Zingara", "Dirtwire", "Dreya V", "Effin", "Gorillat", "Ivy Lab", "Kaleena Zanders", "Lumasi", "MCR-T", "Splintered Sunlight", "Wookywilla", "X Club", "Ammo Amor", "Bardo", "Gavin Blac", "Jelly Bean", "Kattana"],
  },
  {
    day: "Saturday · Aug 8",
    headliners: ["A-Trak", "Ayybo", "Cloonee", "Clozee", "Hedex", "Of the Trees", "Ray Volpe", "Subtronics", "Svdden Death"],
    supporting: ["Hol!", "Level Up", "Louis the Child", "Matroda", "MPH", "Westend", "Biscits", "Discip", "Linska", "Nikita, The Wicked", "Opiuo", "Probcause", "Roddy Lima", "Sippy", "Skysia", "9849", "Alec B2B Ecamp", "Earth Signs", "Mle", "Papyon", "Refrakt", "Sirens"],
  },
  {
    day: "Sunday · Aug 9",
    headliners: ["Charlotte de Witte", "GRiZ", "LSDream", "Porter Robinson", "Sub Focus"],
    supporting: ["Acraze", "Daily Bread", "I Hate Models", "Tiga", "Tractorbeam", "Walker & Royce", "YDG", "Azzecca", "Chyl", "Golden Pony", "Jackie Hollander", "Know Good", "Marvel Years", "The Motet", "Thought Process", "Will Clarke", "Barz", "Brainrack", "Dr. Chaii", "Koopmusik", "Luna Mar", "Pnther"],
  },
];

const DAY_COLORS = ["#CC00FF", "#00D4FF", "#3AFFD4", "#FF5C3A"] as const;

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
            <p className="mt-1 font-bebas text-2xl tracking-widest text-[#3AFFD4]">2026</p>
            <p className="mt-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Music · Art · Camping · Projection Mapping
            </p>
            <p className="mt-2 text-base text-neutral-400">Pocono Raceway, Long Pond, PA</p>
          </div>
          <span className="shrink-0 rounded-full border border-[#3AFFD4]/40 px-4 py-1.5 font-dm-mono text-xs uppercase tracking-widest text-[#3AFFD4]">
            Tickets Available
          </span>
        </div>

        {/* Date */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">Dates</p>
          <p className="mt-1 text-base text-neutral-200">Friday Aug 7 – Sunday Aug 9, 2026</p>
        </div>

        {/* Weather */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
          <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">Forecast at Pocono Raceway</p>
          <WeatherStrip lat={41.0559} lng={-75.5103} />
        </div>

        {/* Description */}
        <div className="mt-4 rounded-2xl border border-[#3AFFD4]/15 bg-[#3AFFD4]/[0.03] px-6 py-5">
          <p className="text-sm leading-7 text-neutral-300">
            Elements Music &amp; Arts Festival is the Northeast&apos;s premier boutique electronic music festival —
            an immersive three-day car camping experience held annually at the iconic Pocono Raceway in
            Long Pond, Pennsylvania. The 2026 edition blends underground electronic music with large-scale
            art installations, wellness programming, and 3D video projection mapping into an independent,
            community-driven gathering unlike anything else in the region.
          </p>
        </div>

        {/* Lineup by day */}
        <div className="mt-8">
          <h2 className="font-bebas text-3xl tracking-wide">2026 Lineup</h2>
          <p className="mt-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
            🍄 = Sunset Set
          </p>

          <div className="mt-4 space-y-4">
            {LINEUP.map((day, i) => (
              <div
                key={day.day}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                style={{ borderLeftColor: DAY_COLORS[i] + "55", borderLeftWidth: "3px" }}
              >
                <p
                  className="mb-3 font-bebas text-xl tracking-wide"
                  style={{ color: DAY_COLORS[i] }}
                >
                  {day.day}
                </p>
                <div className="flex flex-wrap gap-2">
                  {day.headliners.map((a) => (
                    <span
                      key={a}
                      className="rounded-full px-3 py-1 font-dm-mono text-xs font-medium"
                      style={{
                        color: DAY_COLORS[i],
                        background: DAY_COLORS[i] + "18",
                        border: `1px solid ${DAY_COLORS[i]}40`,
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {day.supporting.map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 font-dm-mono text-xs text-neutral-500"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">What to Expect</p>
          <ul className="space-y-2">
            {[
              "Three-day car camping at Pocono Raceway",
              "Electronic music across multiple curated stages",
              "Large-scale interactive art installations",
              "3D video projection mapping",
              "Wellness programming",
              "Independent boutique festival — no corporate fluff",
            ].map((h) => (
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
            href="https://www.elementsfest.us"
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
