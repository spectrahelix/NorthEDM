import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { WeatherStrip } from "../feed/components/WeatherStrip";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Upcoming Local Events",
  description:
    "Auto-updated calendar of festivals and music events near Northeast PA — dates, venues, and the forecast for each, refreshed automatically.",
  openGraph: {
    title: "Upcoming Local Events | NorthEDM",
    description:
      "Festivals and music events near Northeast PA, refreshed automatically with the forecast for each.",
    url: "https://northedm.com/events",
  },
};

// Refreshed by the nightly ingest cron; re-render hourly so newly approved
// events surface without a redeploy.
export const revalidate = 3600;

type LocalEvent = {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  featured?: boolean | null;
  vendor_ids?: number[] | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  source_url: string | null;
};

function fmtRange(start: string | null, end: string | null) {
  if (!start) return "Dates TBA";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start + "T00:00:00");
  const e = end ? new Date(end + "T00:00:00") : null;
  const year = s.getFullYear();
  if (!e || end === start) {
    return `${s.toLocaleDateString("en-US", opts)}, ${year}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}, ${year}`;
}

function isLive(start: string | null, end: string | null, todayISO: string) {
  if (!start) return false;
  return start <= todayISO && (end ?? start) >= todayISO;
}

export default async function EventsPage() {
  const supabase = await createClient();

  // Only approved, non-past events (RLS already limits to approved).
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("local_events")
    .select("id, name, venue, city, region, start_date, end_date, lat, lng, description, source_url, featured, vendor_ids")
    .eq("status", "approved")
    .or(`end_date.gte.${todayISO},start_date.gte.${todayISO}`)
    .order("featured", { ascending: false })
    .order("start_date", { ascending: true, nullsFirst: false });

  const events = (data ?? []) as LocalEvent[];

  // Which NorthEDM vendors are on site at these events, so a card can name them
  // instead of just asserting "vendors are here". One query for the whole page.
  const vendorIds = [...new Set(events.flatMap((e) => e.vendor_ids ?? []))];
  const { data: vendorRows } = vendorIds.length
    ? await supabase.from("vendors").select("id, name").in("id", vendorIds)
    : { data: [] };
  const vendorById = new Map(((vendorRows ?? []) as { id: number; name: string | null }[])
    .map((v) => [v.id, v.name]));

  // Every venue we've ever listed, past events included — the standing record of
  // where this scene actually happens, rather than only what's coming up.
  // Read with the service role on purpose: the public RLS policy exposes only
  // status='approved', so a normal client would silently drop every ARCHIVED
  // event — i.e. all the history this list exists to show. Venue/city/region are
  // public information, so nothing sensitive is widened by reading them here.
  const venueAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: venueRows } = await venueAdmin
    .from("local_events")
    .select("venue, city, region")
    .not("venue", "is", null);
  const venues = [...new Map(
    ((venueRows ?? []) as { venue: string | null; city: string | null; region: string | null }[])
      .filter((v) => v.venue)
      .map((v) => [`${v.venue}|${v.city}`, v])
  ).values()].sort((a, b) => (a.venue ?? "").localeCompare(b.venue ?? ""));

  return (
    <main className="min-h-screen text-neutral-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
            NorthEDM · Auto-updated
          </p>
          <h1 className="font-bebas text-7xl tracking-wide md:text-8xl">Upcoming Local Events</h1>
          <p className="mt-4 max-w-2xl text-neutral-400">
            Festivals and shows across Northeast PA and the surrounding region — collected and
            refreshed automatically, each with its own forecast. Run a vendor booth?{" "}
            <Link href="/profile/edit" className="text-[#3AFFD4] hover:underline">
              Add your own shows
            </Link>{" "}
            to your profile.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-neutral-400">No upcoming events on the radar yet.</p>
            <p className="mt-1 text-sm text-neutral-600">
              The nightly collector will populate this as festivals are announced.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {events.map((event) => {
              const live = isLive(event.start_date, event.end_date, todayISO);
              const place = [event.venue, event.city, event.region].filter(Boolean).join(", ");
              const onSite = (event.vendor_ids ?? [])
                .map((id) => vendorById.get(id))
                .filter(Boolean) as string[];
              return (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bebas text-3xl leading-none tracking-wide">{event.name}</h3>
                        {live && (
                          <span className="rounded-full bg-[#39FF14]/15 px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest text-[#39FF14]">
                            🟢 Live now
                          </span>
                        )}
                        {event.featured && (
                          <span className="rounded-full bg-[#CC00FF]/15 px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest text-[#CC00FF]">
                            ★ Featured
                          </span>
                        )}
                      </div>
                      {place && <p className="mt-1 text-sm text-neutral-400">{place}</p>}
                    </div>
                    <span className="shrink-0 font-dm-mono text-sm text-neutral-300">
                      {fmtRange(event.start_date, event.end_date)}
                    </span>
                  </div>

                  {event.description && (
                    <p className="mt-3 text-sm leading-relaxed text-neutral-400">{event.description}</p>
                  )}

                  {onSite.length > 0 && (
                    <div className="mt-4 rounded-xl border border-[#39FF14]/25 bg-[#39FF14]/[0.06] px-4 py-3">
                      <p className="font-dm-mono text-[11px] uppercase tracking-widest text-[#39FF14]">
                        🏪 NorthEDM {onSite.length === 1 ? "vendor" : "vendors"} on site
                      </p>
                      <p className="mt-1 text-sm text-neutral-200">
                        {onSite.join(" · ")} — find {onSite.length === 1 ? "them" : "them"} at the event.
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {event.source_url && (
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-dm-mono text-xs uppercase tracking-widest text-[#3AFFD4] hover:underline"
                      >
                        Details ↗
                      </a>
                    )}
                  </div>

                  {event.lat != null && event.lng != null && (
                    <WeatherStrip lat={event.lat} lng={event.lng} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {venues.length > 0 && (
          <section className="mt-16 border-t border-white/10 pt-10">
            <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#3AFFD4]">
              The circuit
            </p>
            <h2 className="mt-2 font-bebas text-4xl tracking-wide">Venues we cover</h2>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Every venue that has hosted an event on our radar — past and upcoming. The standing
              map of where this scene actually happens.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {venues.map((v) => (
                <span
                  key={`${v.venue}|${v.city}`}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-neutral-300"
                >
                  {v.venue}
                  {v.city && <span className="ml-1.5 font-dm-mono text-[11px] text-neutral-600">{v.city}</span>}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
