import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { WeatherStrip } from "@/app/components/WeatherStrip";
import { ForestWeather } from "@/app/components/ForestWeather";
import { trendingVendors } from "@/utils/trendingVendors";
import { storeAdminClient } from "@/utils/store";
import { PA_STATE_FORESTS } from "@/utils/paStateForests";

// Everything on this page is read live, so it moves with the rest of the site:
//   - festivals/shows come from `local_events` (the nightly events cron +
//     /admin/events approvals — the same rows /events shows),
//   - trending vendors are ranked by real sales through NorthEDM
//     (utils/trendingVendors.ts),
//   - state forest weather is Open-Meteo, cached for an hour.
// It used to read the `festival_events` / `festival_vendors` seed tables,
// which nobody updated: every festival on it was in the past and the vendors
// were demo rows with made-up growth percentages.
export const revalidate = 3600;

type LocalEvent = {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  lat: number | null;
  lng: number | null;
  source_url: string | null;
  source: string | null;
  featured: boolean | null;
};

// Festivals are the hand-picked rows: curated seeds and owner-added events.
// "Multi-day" alone is not a festival test — venue calendars list three-night
// theatre runs (Beetlejuice, Riverdance) that way.
const FESTIVAL_SOURCES = new Set(["seed", "manual"]);
const isFestival = (e: LocalEvent) => FESTIVAL_SOURCES.has(e.source ?? "") || e.featured === true;

/**
 * Annual festivals whose next dates were rolled forward by the events cron and
 * are waiting for the owner to confirm them in /admin/events. Shown by name
 * only — the estimated dates stay off the public page until approved.
 * Pending rows aren't readable through RLS, hence the service role; only
 * name/place leave this function.
 */
async function returningFestivals(): Promise<{ name: string; place: string }[]> {
  try {
    const { data } = await storeAdminClient()
      .from("local_events")
      .select("name, city, region, start_date")
      .eq("status", "pending")
      .eq("source", "seed")
      .order("start_date", { ascending: true });
    const seen = new Set<string>();
    return ((data ?? []) as { name: string; city: string | null; region: string | null }[])
      .filter((r) => (seen.has(r.name) ? false : (seen.add(r.name), true)))
      .map((r) => ({ name: r.name, place: [r.city, r.region].filter(Boolean).join(", ") }));
  } catch {
    return [];
  }
}

const SALES_WINDOW_DAYS = 30;

function fmtRange(start: string | null, end: string | null) {
  if (!start) return "Dates TBA";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString("en-US", opts);
  if (!end || end === start) return s;
  return `${s} – ${new Date(`${end}T00:00:00`).toLocaleDateString("en-US", opts)}`;
}

function todayEastern() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export default async function CrowdWaveFeedPage() {
  const supabase = await createClient();
  const today = todayEastern();

  const [{ data: eventsData }, { data: carpoolData }, trending, returning] = await Promise.all([
    supabase
      .from("local_events")
      .select("id, name, venue, city, region, start_date, end_date, lat, lng, source_url, source, featured")
      .eq("status", "approved")
      .or(`end_date.gte.${today},start_date.gte.${today}`)
      .order("start_date", { ascending: true, nullsFirst: false }),
    supabase.from("community_groups").select("id").eq("category", "Carpool"),
    trendingVendors(SALES_WINDOW_DAYS, 50).catch(() => []),
    returningFestivals(),
  ]);

  const upcoming = (eventsData ?? []) as LocalEvent[];
  const festivals = upcoming.filter(isFestival);
  const shows = upcoming.filter((e) => !isFestival(e));
  // Don't list a festival as "returning" when its confirmed dates are already up.
  const confirmed = new Set(festivals.map((e) => e.name));
  const returningSoon = returning.filter((r) => !confirmed.has(r.name));
  const carpoolGroups = carpoolData?.length ?? 0;
  const topVendors = trending.slice(0, 6);

  return (
    <main className="min-h-screen text-neutral-100">
      {/* Hero */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
            CrowdWave
          </p>
          <h1 className="font-bebas text-7xl tracking-wide md:text-9xl">
            Festival Hub
          </h1>
          <p className="mt-4 max-w-xl text-neutral-400">
            Upcoming festivals, the vendors people are actually buying from, and
            conditions in Pennsylvania&apos;s state forests — refreshed every day.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/forum"
              className="rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Open Forum
            </Link>
            <Link
              href="/crowdwave/groups"
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              Community Groups
            </Link>
            <Link
              href="/events"
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              All Events
            </Link>
          </div>
        </div>
      </section>

      {/* Insight Bar — plain counts, each from a live table */}
      <section className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Stat n={festivals.length} label="festivals with confirmed dates" />
            <Stat n={shows.length} label="shows ahead" />
            <Stat n={trending.length} label="hot vendors right now" />
            <Stat n={carpoolGroups} label="carpool groups" />
            <Stat n={PA_STATE_FORESTS.length} label="state forests tracked" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12 lg:grid lg:grid-cols-3 lg:gap-12">
        {/* Festivals – left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-bebas text-4xl tracking-wide">Upcoming Festivals</h2>

          {festivals.length === 0 && returningSoon.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-neutral-500">
              No festivals with confirmed dates right now.{" "}
              <Link href="/events" className="text-[#3AFFD4] hover:underline">
                See every upcoming show
              </Link>
              .
            </div>
          ) : (
            festivals.slice(0, 8).map((event) => <EventCard key={event.id} event={event} />)
          )}

          {returningSoon.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="font-bebas text-2xl tracking-wide">Returning Next Season</h3>
              <p className="mt-1 text-xs text-neutral-500">
                Annual festivals in our region. Next year&apos;s dates are being confirmed and
                will appear here with the forecast once they are.
              </p>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {returningSoon.map((r) => (
                  <li key={r.name} className="text-sm">
                    <span className="text-neutral-200">{r.name}</span>
                    {r.place && <span className="block text-xs text-neutral-500">{r.place}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {shows.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-bebas text-2xl tracking-wide">Next Shows</h3>
                <Link href="/events" className="font-dm-mono text-xs text-[#3AFFD4] hover:underline">
                  all {upcoming.length} →
                </Link>
              </div>
              <ul className="divide-y divide-white/5">
                {shows.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-neutral-200">{e.name}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        {[e.venue, e.city].filter(Boolean).join(", ")}
                      </span>
                    </span>
                    <span className="shrink-0 font-dm-mono text-xs text-neutral-400">
                      {fmtRange(e.start_date, e.end_date)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Vendors – right 1/3 */}
        <div className="mt-12 lg:mt-0 space-y-5">
          <div>
            <h2 className="font-bebas text-4xl tracking-wide">Trending Vendors</h2>
            <p className="mt-1 text-xs text-neutral-500">
              NorthEDM vendors people are buying from and visiting most on this
              site over the last {SALES_WINDOW_DAYS} days.
            </p>
          </div>

          {topVendors.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-neutral-500">
              Nobody&apos;s trending yet — vendors show up here once people start
              buying from them or visiting their shops.{" "}
              <Link href="/marketplace" className="text-[#3AFFD4] hover:underline">
                Browse the marketplace
              </Link>
              .
            </div>
          ) : (
            topVendors.map((vendor) => (
              <Link
                key={vendor.id}
                href={`/marketplace/${vendor.id}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{vendor.name}</p>
                    {vendor.category && (
                      <p className="text-xs text-neutral-500">{vendor.category}</p>
                    )}
                  </div>
                  <HotBadge />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Pennsylvania State Forests */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="font-bebas text-4xl tracking-wide">Pennsylvania State Forests</h2>
              <span className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
                Local weather · updated hourly
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-xs text-neutral-500">
              Current temperature, the next three days, and rain over the past week —
              the number foragers watch. Forecasts from Open-Meteo for one point in
              each forest; conditions vary across a large tract. Tap a forest for
              DCNR maps and rules.
            </p>
          </div>
          <ForestWeather />
        </div>
      </section>
    </main>
  );
}

function HotBadge() {
  return (
    <span className="shrink-0 rounded-full bg-[#FF5C3A]/15 px-2 py-0.5 font-dm-mono text-xs uppercase tracking-widest text-[#FF5C3A]">
      🔥 Hot topic
    </span>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <span className="font-dm-mono font-semibold text-[#E8FF47]">{n}</span>
      <span className="ml-2 text-neutral-400">{label}</span>
    </div>
  );
}

function EventCard({ event }: { event: LocalEvent }) {
  const place = [event.venue, event.city, event.region].filter(Boolean).join(", ");
  const body = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-bebas text-3xl tracking-wide leading-none">{event.name}</h3>
          {place && <p className="mt-1 text-sm text-neutral-400">{place}</p>}
        </div>
        {event.source_url && (
          <span className="shrink-0 font-dm-mono text-xs text-neutral-600">↗</span>
        )}
      </div>
      <p className="mt-3 font-dm-mono text-sm text-neutral-300">
        {fmtRange(event.start_date, event.end_date)}
      </p>
      {event.lat != null && event.lng != null && (
        <WeatherStrip
          lat={event.lat}
          lng={event.lng}
          startDate={event.start_date}
          endDate={event.end_date}
        />
      )}
    </>
  );
  const cls =
    "block rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.06]";
  return event.source_url ? (
    <a href={event.source_url} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href="/events" className={cls}>
      {body}
    </Link>
  );
}
