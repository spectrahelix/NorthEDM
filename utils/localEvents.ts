import type { SupabaseClient } from "@supabase/supabase-js";

// Local Events ingest: shared by the nightly cron (app/api/cron/local-events)
// and the admin "Refresh now" button. Two sources feed one table:
//
//   1. Curated seed list — known regional festivals near NE PA. Trusted, so
//      auto-approved. Refreshing updates their details but never overwrites an
//      admin's status decision (e.g. one they hid stays hidden).
//   2. Ticketmaster Discovery — optional, only if TICKETMASTER_API_KEY is set.
//      Geo-scoped to the seed center. New finds land as 'pending' for review;
//      already-known events are left untouched.
//
// Region center used for discovery + a sensible default for undated seeds:
// Nescopeck, PA (Briggs Farm country). ~100mi radius covers the NE PA footprint.

export const REGION_CENTER = { lat: 41.0459, lng: -76.2205 };
export const REGION_RADIUS_MILES = 100;

export type IngestEvent = {
  name: string;
  venue?: string | null;
  city?: string | null;
  region?: string | null;
  start_date?: string | null; // YYYY-MM-DD
  end_date?: string | null;
  lat?: number | null;
  lng?: number | null;
  description?: string | null;
  source: "seed" | "ticketmaster" | "manual";
  source_url?: string | null;
};

// Curated festivals within ~100mi of Nescopeck, PA. Dates are best-known and
// admin-editable on the review screen — treat them as a starting point, not
// gospel. These auto-approve because we vouch for them.
const SEED_EVENTS: IngestEvent[] = [
  {
    name: "Briggs Farm Blues Festival",
    venue: "Briggs Farm",
    city: "Nescopeck",
    region: "PA",
    start_date: "2026-07-09",
    end_date: "2026-07-11",
    lat: 41.0459,
    lng: -76.2205,
    description:
      "Long-running blues festival on a working farm in Nescopeck — camping, multiple stages, and a porch stage tradition.",
    source: "seed",
    source_url: "https://www.briggsfarm.com/",
  },
  {
    name: "Elements Music & Arts Festival",
    venue: "Pocono Raceway",
    city: "Long Pond",
    region: "PA",
    start_date: "2026-08-07",
    end_date: "2026-08-10",
    lat: 41.0559,
    lng: -75.5103,
    description: "Immersive electronic music & arts festival in the Poconos.",
    source: "seed",
    source_url: "https://elementsfestival.com/",
  },
  {
    name: "The Peach Music Festival",
    venue: "Montage Mountain",
    city: "Scranton",
    region: "PA",
    start_date: "2026-06-25",
    end_date: "2026-06-28",
    lat: 41.3179,
    lng: -75.6621,
    description: "Jam and roots music festival on Montage Mountain.",
    source: "seed",
    source_url: "https://www.thepeachmusicfestival.com/",
  },
  {
    name: "Camp Bisco",
    venue: "Montage Mountain",
    city: "Scranton",
    region: "PA",
    start_date: "2026-07-16",
    end_date: "2026-07-18",
    lat: 41.3179,
    lng: -75.6621,
    description: "Electronic and jam music camping festival hosted by The Disco Biscuits.",
    source: "seed",
    source_url: "https://www.campbisco.net/",
  },
  {
    name: "Musikfest",
    venue: "Historic Bethlehem",
    city: "Bethlehem",
    region: "PA",
    start_date: "2026-08-07",
    end_date: "2026-08-16",
    lat: 40.6259,
    lng: -75.3705,
    description: "Ten-day free music festival across downtown Bethlehem.",
    source: "seed",
    source_url: "https://www.musikfest.org/",
  },
  {
    name: "NEPA Bluegrass Festival",
    venue: "Lazybrook Park",
    city: "Tunkhannock",
    region: "PA",
    start_date: "2026-05-21",
    end_date: "2026-05-24",
    lat: 41.5387,
    lng: -75.9469,
    description: "Bluegrass festival and campout along the Susquehanna.",
    source: "seed",
    source_url: "https://www.nepabluegrass.com/",
  },
  {
    name: "Susquehanna Breakdown Music Festival",
    venue: "Montage Mountain",
    city: "Scranton",
    region: "PA",
    start_date: "2026-05-23",
    end_date: "2026-05-24",
    lat: 41.3179,
    lng: -75.6621,
    description: "Jam and roots music festival kicking off the Montage season.",
    source: "seed",
    source_url: "https://www.montagemountainresorts.com/",
  },
];

function slug(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dedupKey(e: IngestEvent): string {
  return [slug(e.name), slug(e.city || e.region || ""), e.start_date || ""].join("|");
}

// Pull upcoming music events near the region center from Ticketmaster's free
// Discovery API. Returns [] (never throws) if the key is missing or the call
// fails — discovery is best-effort; the curated seeds always run regardless.
async function fetchTicketmaster(): Promise<IngestEvent[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    apikey: key,
    latlong: `${REGION_CENTER.lat},${REGION_CENTER.lng}`,
    radius: String(REGION_RADIUS_MILES),
    unit: "miles",
    classificationName: "music",
    sort: "date,asc",
    size: "50",
  });
  try {
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    if (!res.ok) {
      console.error("ticketmaster discovery failed:", res.status);
      return [];
    }
    const data = await res.json();
    const events = data?._embedded?.events ?? [];
    const out: IngestEvent[] = [];
    for (const ev of events) {
      const name = String(ev?.name || "").trim();
      if (!name) continue;
      const venue = ev?._embedded?.venues?.[0] ?? {};
      const loc = venue?.location ?? {};
      out.push({
        name,
        venue: venue?.name ?? null,
        city: venue?.city?.name ?? null,
        region: venue?.state?.stateCode ?? venue?.state?.name ?? null,
        start_date: ev?.dates?.start?.localDate ?? null,
        end_date: ev?.dates?.end?.localDate ?? ev?.dates?.start?.localDate ?? null,
        lat: loc?.latitude ? Number(loc.latitude) : null,
        lng: loc?.longitude ? Number(loc.longitude) : null,
        description: null,
        source: "ticketmaster",
        source_url: ev?.url ?? null,
      });
    }
    return out;
  } catch (e) {
    console.error("ticketmaster discovery error:", e);
    return [];
  }
}

export type IngestResult = {
  seeded: number;
  updated: number;
  discovered: number;
  skipped: number;
  discoverySource: string | null;
};

// Run the full ingest against a service-role client. Curated seeds are
// inserted (approved) or refreshed in place; discovered events are inserted as
// 'pending' only when brand new. Never disturbs an admin's status decisions.
export async function runLocalEventsIngest(admin: SupabaseClient): Promise<IngestResult> {
  const discovered = await fetchTicketmaster();

  // Dedup incoming by key (seeds win over discovery on collision).
  const incoming = new Map<string, IngestEvent>();
  for (const e of discovered) incoming.set(dedupKey(e), e);
  for (const e of SEED_EVENTS) incoming.set(dedupKey(e), e); // overwrite

  const keys = [...incoming.keys()];
  const { data: existingRows } = await admin
    .from("local_events")
    .select("dedup_key")
    .in("dedup_key", keys);
  const existing = new Set((existingRows ?? []).map((r: { dedup_key: string }) => r.dedup_key));

  const result: IngestResult = {
    seeded: 0,
    updated: 0,
    discovered: 0,
    skipped: 0,
    discoverySource: discovered.length ? "ticketmaster" : null,
  };

  const toInsert: Record<string, unknown>[] = [];

  for (const [key, e] of incoming) {
    const row = {
      name: e.name,
      venue: e.venue ?? null,
      city: e.city ?? null,
      region: e.region ?? null,
      start_date: e.start_date ?? null,
      end_date: e.end_date ?? null,
      lat: e.lat ?? null,
      lng: e.lng ?? null,
      description: e.description ?? null,
      source: e.source,
      source_url: e.source_url ?? null,
      dedup_key: key,
    };

    if (existing.has(key)) {
      if (e.source === "seed") {
        // Refresh curated details but preserve the admin's status choice.
        const { name, venue, city, region, start_date, end_date, lat, lng, description, source_url } = row;
        await admin
          .from("local_events")
          .update({ name, venue, city, region, start_date, end_date, lat, lng, description, source_url })
          .eq("dedup_key", key);
        result.updated++;
      } else {
        result.skipped++; // discovered + already known → leave admin decision alone
      }
      continue;
    }

    // New row. Seeds are trusted → approved; discovery → pending review.
    toInsert.push({ ...row, status: e.source === "seed" ? "approved" : "pending" });
    if (e.source === "seed") result.seeded++;
    else result.discovered++;
  }

  if (toInsert.length) {
    const { error } = await admin.from("local_events").insert(toInsert);
    if (error) console.error("local_events insert error:", error.message);
  }

  return result;
}
