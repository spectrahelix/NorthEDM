import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { WeatherStrip } from "./components/WeatherStrip";

type FestivalEvent = {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  lat: number;
  lng: number;
  ticket_status: string;
  badge: string | null;
  href: string;
};

type FestivalVendor = {
  id: number;
  name: string;
  category: string;
  emoji: string;
  upcoming_shows_count: number;
  growth_percent: number;
};

const PINNED_EVENTS: FestivalEvent[] = [
  {
    id: -1,
    name: "Elements Music & Arts Festival",
    location: "Pocono Raceway, Long Pond, PA",
    start_date: "2026-08-07",
    end_date: "2026-08-09",
    lat: 41.0559,
    lng: -75.5103,
    ticket_status: "available",
    badge: "hot",
    href: "/crowdwave/festival/elements-2026",
  },
];

const BADGE_STYLES: Record<string, string> = {
  hot: "bg-[#FF5C3A]/20 text-[#FF5C3A]",
  new: "bg-[#3AFFD4]/20 text-[#3AFFD4]",
  soon: "bg-[#E8FF47]/20 text-[#E8FF47]",
};

const TICKET_LABEL: Record<string, string> = {
  available: "Tickets Available",
  limited: "Limited",
  sold_out: "Sold Out",
};

const FORAGING_CONDITIONS: {
  name: string;
  condition: "good" | "fair" | "poor";
  notes: string;
}[] = [
  {
    name: "Blue Ridge",
    condition: "good",
    notes: "Chanterelles peaking, morels winding down. Check oak ridgelines.",
  },
  {
    name: "Smoky Mountains",
    condition: "fair",
    notes: "Dry spell in effect — check north-facing slopes and stream drainages.",
  },
  {
    name: "Catskills",
    condition: "good",
    notes: "Hen of the woods coming in strong near old-growth oak.",
  },
  {
    name: "Adirondacks",
    condition: "poor",
    notes: "Too wet after recent rains. Wait 5–7 days before heading out.",
  },
];

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

export default async function CrowdWaveFeedPage() {
  const supabase = await createClient();

  const [
    { data: eventsData },
    { data: vendorsData },
    { count: memberCount },
    { count: eventsCount },
    { data: carpoolData },
  ] = await Promise.all([
    supabase
      .from("festival_events")
      .select("*")
      .order("start_date", { ascending: true }),
    supabase
      .from("festival_vendors")
      .select("*")
      .order("growth_percent", { ascending: false }),
    supabase
      .from("group_members")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("festival_events")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("community_groups")
      .select("id")
      .eq("category", "Carpool"),
  ]);

  const dbEvents = ((eventsData ?? []) as Omit<FestivalEvent, "href">[])
    .filter((e) => !PINNED_EVENTS.some((p) => p.name === e.name))
    .map((e) => ({ ...e, href: `/crowdwave/festival/${e.id}` }));
  const events: FestivalEvent[] = [...PINNED_EVENTS, ...dbEvents];
  const vendors = (vendorsData ?? []) as FestivalVendor[];
  const totalVendorShows = vendors.reduce(
    (sum, v) => sum + (v.upcoming_shows_count ?? 0),
    0
  );
  const carpoolGroups = carpoolData?.length ?? 0;

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
            Upcoming events, community intel, trending vendors, and the people
            who live for the music.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/crowdwave/forum"
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
          </div>
        </div>
      </section>

      {/* Insight Bar */}
      <section className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap gap-8 text-sm">
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">
                {memberCount ?? 0}
              </span>
              <span className="ml-2 text-neutral-400">members attending</span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">
                {eventsCount ?? 0}
              </span>
              <span className="ml-2 text-neutral-400">festivals on radar</span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">
                {totalVendorShows}
              </span>
              <span className="ml-2 text-neutral-400">
                vendors at upcoming shows
              </span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">
                {carpoolGroups}
              </span>
              <span className="ml-2 text-neutral-400">carpool groups forming</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12 lg:grid lg:grid-cols-3 lg:gap-12">
        {/* Events – left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-bebas text-4xl tracking-wide">
            Upcoming Festivals
          </h2>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-neutral-500">
              No upcoming events yet — check back soon.
            </div>
          ) : (
            events.map((event) => (
              <Link
                key={event.id}
                href={event.href}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bebas text-3xl tracking-wide leading-none">
                      {event.name}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-400">
                      {event.location}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {event.badge && (
                      <span
                        className={`rounded-full px-3 py-1 font-dm-mono text-xs uppercase tracking-widest ${
                          BADGE_STYLES[event.badge] ?? "bg-white/10 text-neutral-300"
                        }`}
                      >
                        {event.badge}
                      </span>
                    )}
                    <span className="font-dm-mono text-xs text-neutral-600">→</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <span className="font-dm-mono text-neutral-300">
                    {formatDateRange(event.start_date, event.end_date)}
                  </span>
                  <span
                    className={`font-dm-mono text-xs uppercase tracking-widest ${
                      event.ticket_status === "available"
                        ? "text-[#3AFFD4]"
                        : event.ticket_status === "limited"
                        ? "text-[#FFB347]"
                        : "text-neutral-500 line-through"
                    }`}
                  >
                    {TICKET_LABEL[event.ticket_status] ?? event.ticket_status}
                  </span>
                </div>

                <WeatherStrip lat={event.lat} lng={event.lng} />
              </Link>
            ))
          )}
        </div>

        {/* Vendors – right 1/3 */}
        <div className="mt-12 lg:mt-0 space-y-5">
          <h2 className="font-bebas text-4xl tracking-wide">
            Trending Vendors
          </h2>

          {vendors.length === 0 ? (
            <p className="text-neutral-500 text-sm">No vendors yet.</p>
          ) : (
            vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{vendor.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">
                      {vendor.name}
                    </p>
                    <p className="text-xs text-neutral-500">{vendor.category}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#E8FF47]/10 px-2 py-0.5 font-dm-mono text-xs text-[#E8FF47]">
                    +{vendor.growth_percent}%
                  </span>
                </div>
                <p className="mt-2 font-dm-mono text-xs text-neutral-600">
                  at {vendor.upcoming_shows_count} upcoming shows
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Foraging Conditions */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex items-baseline gap-4">
            <h2 className="font-bebas text-4xl tracking-wide">
              Foraging Conditions
            </h2>
            <span className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
              Appalachian Subregions
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FORAGING_CONDITIONS.map((region) => (
              <div
                key={region.name}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm">{region.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-dm-mono text-xs uppercase tracking-widest ${
                      region.condition === "good"
                        ? "bg-[#3AFFD4]/10 text-[#3AFFD4]"
                        : region.condition === "fair"
                        ? "bg-[#E8FF47]/10 text-[#E8FF47]"
                        : "bg-[#FF5C3A]/10 text-[#FF5C3A]"
                    }`}
                  >
                    {region.condition}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {region.notes}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
