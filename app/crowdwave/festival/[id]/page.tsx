import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WeatherStrip } from "../../components/WeatherStrip";
import type { Metadata } from "next";

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

const TICKET_LABEL: Record<string, string> = {
  available: "Tickets Available",
  limited:   "Limited Tickets",
  sold_out:  "Sold Out",
};

const TICKET_COLOR: Record<string, string> = {
  available: "#3AFFD4",
  limited:   "#FFB347",
  sold_out:  "#FF5C3A",
};

const BADGE_STYLES: Record<string, string> = {
  hot:  "bg-[#FF5C3A]/20 text-[#FF5C3A]",
  new:  "bg-[#3AFFD4]/20 text-[#3AFFD4]",
  soon: "bg-[#FFB347]/20 text-[#FFB347]",
};

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "long", day: "numeric", year: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} — ${e.toLocaleDateString("en-US", opts)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("festival_events").select("name, location").eq("id", id).single();
  return {
    title: data?.name ?? "Festival",
    description: data ? `${data.name} at ${data.location} — NorthEDM festival tracker.` : "",
  };
}

export default async function FestivalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("festival_events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const event = data as FestivalEvent;
  const ticketColor = TICKET_COLOR[event.ticket_status] ?? "#888";

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
            {event.badge && (
              <span className={`mb-3 inline-block rounded-full px-3 py-1 font-dm-mono text-xs uppercase tracking-widest ${BADGE_STYLES[event.badge] ?? "bg-white/10 text-neutral-300"}`}>
                {event.badge}
              </span>
            )}
            <h1 className="font-bebas text-[clamp(2.5rem,8vw,5rem)] leading-none tracking-wide">
              {event.name}
            </h1>
            <p className="mt-2 text-base text-neutral-400">{event.location}</p>
          </div>
          <span
            className="shrink-0 rounded-full border px-4 py-1.5 font-dm-mono text-xs uppercase tracking-widest"
            style={{ color: ticketColor, borderColor: ticketColor + "55" }}
          >
            {TICKET_LABEL[event.ticket_status] ?? event.ticket_status}
          </span>
        </div>

        {/* Date */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">Dates</p>
          <p className="mt-1 text-base text-neutral-200">{formatDateRange(event.start_date, event.end_date)}</p>
        </div>

        {/* Weather */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4">
          <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-600">Forecast at Venue</p>
          <WeatherStrip lat={event.lat} lng={event.lng} />
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/crowdwave/forum"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Discuss on Forum →
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
