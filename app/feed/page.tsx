import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import type { Metadata } from "next";
import { WeatherStrip } from "./components/WeatherStrip";

export const metadata: Metadata = {
  title: "What's Happening",
  description:
    "Northeast EDM festival calendar, local show listings, trending vendors, and Appalachian foraging conditions — all in one feed.",
  openGraph: {
    title: "What's Happening | NorthEDM",
    description:
      "Northeast EDM festival calendar, local show listings, trending vendors, and Appalachian foraging conditions.",
    url: "https://northedm.com/feed",
  },
};

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
};

type FestivalVendor = {
  id: number;
  name: string;
  category: string;
  emoji: string;
  upcoming_shows_count: number;
  growth_percent: number;
};

type ForagingCondition = {
  id: number;
  region: string;
  condition: "good" | "fair" | "poor";
  notes: string;
  updated_at: string;
};

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

const EVENTS_FALLBACK: FestivalEvent[] = [
  {
    id: 1,
    name: "Firefly Music Festival",
    location: "The Woodlands, Dover, DE",
    start_date: "2026-06-18",
    end_date: "2026-06-21",
    lat: 39.1518,
    lng: -75.5242,
    ticket_status: "available",
    badge: "soon",
  },
  {
    id: 2,
    name: "Resonance Music Festival",
    location: "Artemas, PA",
    start_date: "2026-07-21",
    end_date: "2026-07-25",
    lat: 39.7423,
    lng: -78.3015,
    ticket_status: "available",
    badge: "new",
  },
  {
    id: 3,
    name: "Elements Music & Arts Festival",
    location: "Pocono Raceway, Long Pond, PA",
    start_date: "2026-08-07",
    end_date: "2026-08-09",
    lat: 41.0559,
    lng: -75.7129,
    ticket_status: "limited",
    badge: "hot",
  },
];

const LOCAL_SHOWS = [
  { city: "Brooklyn, NY", venue: "Avant Gardner", night: "Fri–Sat", genre: "Techno / House", note: "Recurring deep techno programming" },
  { city: "Philadelphia, PA", venue: "The Fillmore", night: "Varies", genre: "Bass / Electronic", note: "Frequent touring EDM stops" },
  { city: "Boston, MA", venue: "Big Night Live", night: "Fri–Sat", genre: "House / Bass", note: "Club nights + touring artists" },
  { city: "Pittsburgh, PA", venue: "Club Café", night: "Varies", genre: "Underground Electronic", note: "Regional underground circuit" },
  { city: "Asheville, NC", venue: "The Orange Peel", night: "Varies", genre: "Jam / Electronic", note: "Appalachian gateway stop" },
  { city: "Albany, NY", venue: "Upstate Concert Hall", night: "Varies", genre: "Bass / Dubstep", note: "Upstate touring corridor" },
];

const FORAGING_FALLBACK: ForagingCondition[] = [
  { id: 1, region: "Blue Ridge (VA/NC)", condition: "good", notes: "Chanterelles peaking. Check southern hollows after rain.", updated_at: "" },
  { id: 2, region: "Smoky Mountains", condition: "fair", notes: "Dry spell — focus on north-facing slopes and creek drainages.", updated_at: "" },
  { id: 3, region: "Catskills (NY)", condition: "good", notes: "Hen of the woods coming in strong near old-growth oak.", updated_at: "" },
  { id: 4, region: "Adirondacks (NY)", condition: "poor", notes: "Too saturated. Wait 5–7 days before heading out.", updated_at: "" },
  { id: 5, region: "Poconos (PA)", condition: "good", notes: "Chicken of the woods fruiting on downed oak and locust.", updated_at: "" },
  { id: 6, region: "Appalachian Trail (NJ/PA)", condition: "fair", notes: "Oysters spotted near fallen hardwoods. Chanterelles starting.", updated_at: "" },
  { id: 7, region: "White Mountains (NH)", condition: "good", notes: "Boletes and chanterelles on higher trails. Good moisture.", updated_at: "" },
  { id: 8, region: "Green Mountains (VT)", condition: "fair", notes: "Mixed conditions. Lobster mushrooms showing in spots.", updated_at: "" },
];

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

export default async function FeedPage() {
  const supabase = await createClient();

  const [
    { data: eventsData },
    { data: vendorsData },
    { count: threadCount },
    { count: groupCount },
    { count: memberCount },
    { count: eventsCount },
    { data: foragingData },
  ] = await Promise.all([
    supabase.from("festival_events").select("*").order("start_date", { ascending: true }),
    supabase.from("festival_vendors").select("*").order("growth_percent", { ascending: false }),
    supabase.from("threads").select("*", { count: "exact", head: true }),
    supabase.from("community_groups").select("*", { count: "exact", head: true }),
    supabase.from("group_members").select("*", { count: "exact", head: true }),
    supabase.from("festival_events").select("*", { count: "exact", head: true }),
    supabase.from("foraging_conditions").select("*").order("id", { ascending: true }),
  ]);

  const events = ((eventsData?.length ? eventsData : EVENTS_FALLBACK)) as FestivalEvent[];
  const vendors = (vendorsData ?? []) as FestivalVendor[];
  const foraging = (foragingData?.length ? foragingData : FORAGING_FALLBACK) as ForagingCondition[];
  const totalVendorShows = vendors.reduce((sum, v) => sum + (v.upcoming_shows_count ?? 0), 0);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
            NorthEDM
          </p>
          <h1 className="font-bebas text-7xl tracking-wide md:text-9xl">
            What&apos;s Happening
          </h1>
          <p className="mt-4 max-w-xl text-neutral-400">
            Upcoming festivals, community intel, trending vendors, and the Appalachian foraging scene.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/forum"
              className="rounded-xl bg-[#E8FF47] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
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

      {/* Pulse Bar */}
      <section className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap gap-8 text-sm">
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">{threadCount ?? 0}</span>
              <span className="ml-2 text-neutral-400">active threads</span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">{groupCount ?? 0}</span>
              <span className="ml-2 text-neutral-400">community groups</span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">{memberCount ?? 0}</span>
              <span className="ml-2 text-neutral-400">members attending</span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">{eventsCount ?? 0}</span>
              <span className="ml-2 text-neutral-400">festivals on radar</span>
            </div>
            <div>
              <span className="font-dm-mono font-semibold text-[#E8FF47]">{totalVendorShows}</span>
              <span className="ml-2 text-neutral-400">vendor appearances</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12 lg:grid lg:grid-cols-3 lg:gap-12">
        {/* Events — left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-bebas text-4xl tracking-wide">Upcoming Festivals</h2>

          {events.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bebas text-3xl tracking-wide leading-none">{event.name}</h3>
                    <p className="mt-1 text-sm text-neutral-400">{event.location}</p>
                  </div>
                  {event.badge && (
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 font-dm-mono text-xs uppercase tracking-widest ${
                        BADGE_STYLES[event.badge] ?? "bg-white/10 text-neutral-300"
                      }`}
                    >
                      {event.badge}
                    </span>
                  )}
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
                        ? "text-[#E8FF47]"
                        : "text-neutral-500 line-through"
                    }`}
                  >
                    {TICKET_LABEL[event.ticket_status] ?? event.ticket_status}
                  </span>
                </div>

                <WeatherStrip lat={event.lat} lng={event.lng} />
              </div>
            ))}
        </div>

        {/* Vendors — right 1/3 */}
        <div className="mt-12 lg:mt-0 space-y-5">
          <h2 className="font-bebas text-4xl tracking-wide">Trending Vendors</h2>

          {/* Homestead Life — permanent founder pin */}
          <a
            href="https://homestead-life.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl border border-[#3AFFD4]/30 bg-[#3AFFD4]/[0.04] p-5 transition hover:bg-[#3AFFD4]/[0.07]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌿</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">Homestead Life</p>
                <p className="text-xs text-neutral-500">Holistic Goods · Millville, PA</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#E8FF47]/15 px-2 py-0.5 font-dm-mono text-[10px] text-[#E8FF47]">
                Founder
              </span>
            </div>
            <p className="mt-2 font-dm-mono text-xs text-neutral-500">
              Everything Balm · Essential Oils · Natural Skincare
            </p>
          </a>

          {vendors.length === 0 ? (
            <p className="text-sm text-neutral-500">No vendors yet.</p>
          ) : (
            vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{vendor.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{vendor.name}</p>
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

      {/* Local Shows & Venue Nights */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#FF5C3A]">
                Local Scene
              </p>
              <h2 className="mt-1 font-bebas text-4xl tracking-wide">Venue Nights &amp; Shows</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Recurring venue programming across the Northeast corridor.
              </p>
            </div>
            <Link
              href="/forum"
              className="shrink-0 rounded-xl border border-white/10 px-4 py-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-400 transition hover:text-white"
            >
              Submit a show →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LOCAL_SHOWS.map((show) => (
              <div
                key={show.venue}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:bg-white/[0.04]"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold leading-tight">{show.venue}</p>
                    <p className="font-dm-mono text-xs text-neutral-500">{show.city}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#FF5C3A]/10 px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest text-[#FF5C3A]">
                    {show.night}
                  </span>
                </div>
                <p className="mt-2 font-dm-mono text-xs text-neutral-400">{show.genre}</p>
                <p className="mt-1 text-xs text-neutral-600">{show.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Foraging Conditions */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex items-baseline gap-4">
            <h2 className="font-bebas text-4xl tracking-wide">Foraging Conditions</h2>
            <span className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
              Appalachian Subregions
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {foraging.map((region) => (
              <div
                key={region.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{region.region}</p>
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
                <p className="text-xs leading-relaxed text-neutral-500">{region.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
