import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchVenueFeeds, VENUE_FEEDS } from "./venueFeeds";

// Local Events ingest: shared by the nightly cron (app/api/cron/local-events)
// and the admin "Refresh now" button. Several sources feed one table:
//
//   1. Curated seed list — known regional festivals near NE PA. Trusted, so
//      auto-approved. Refreshing updates their details but never overwrites an
//      admin's status decision (e.g. one they hid stays hidden). Seeds marked
//      `annual` roll themselves forward a year once they're over, so the list
//      can't quietly empty out the way it did in Aug 2026.
//   2. Ticketmaster Discovery — optional, only if TICKETMASTER_API_KEY is set.
//   3. SeatGeek Platform API — optional, only if SEATGEEK_CLIENT_ID is set.
//      Catches a lot of the independent/regional bills Ticketmaster misses.
//   4. Venue calendar feeds (utils/venueFeeds) — always on, no key needed.
//      Reads regional venues' own published calendars, which is the only place
//      the smaller rooms and community stages ever appear.
//
// The ticketing sources are geo-scoped to the region center and paginated; the
// venue feeds are inherently in-region because the venue list is curated.
// New finds land as 'pending' for review; already-known events are left alone.
//
// Region center used for discovery + a sensible default for undated seeds:
// Nescopeck, PA (Briggs Farm country).
//
// 75mi, not 100. At 100 the circle reached Philadelphia, and Philly's ticketed
// volume is so much larger than NEPA's that it swamped the feed: 33 of 45
// discovered events came from the 80-100mi band (Philadelphia, Camden NJ,
// Wilmington DE) while Scranton and Wilkes-Barre returned nothing at all. The
// curated venue watchlist is not distance-filtered, so the Philadelphia rooms
// actually worth covering stay covered regardless of this number.

export const REGION_CENTER = { lat: 41.0459, lng: -76.2205 };
export const REGION_RADIUS_MILES = 75;

// How deep to page each discovery source. 3 × 100 is far more than this region
// produces in a night; it exists so a busy festival week isn't truncated at 50.
const PAGE_SIZE = 100;
const MAX_PAGES = 3;

export type EventSource = "seed" | "ticketmaster" | "seatgeek" | "venue" | "manual";

// ── Genre gate for individual shows ────────────────────────────────────────
//
// This site is about EDM and the jam/festival scene. Left ungated, the
// ticketing APIs fill the review queue with everything a region sells —
// Broadway, arena rock, tribute acts, comedy — which is noise here however
// legitimate it is elsewhere.
//
// So INDIVIDUAL SHOWS from Ticketmaster and SeatGeek must match a genre below.
// FESTIVALS do not: a multi-day festival is the thing this site exists for, and
// its billing is usually mixed anyway, so it's kept whatever its listed genre.
// Curated seeds and the venue watchlist are hand-picked and never gated.
//
// TUNE HERE. This is a taste judgement, not a technical constraint — edit this
// one regex to widen or narrow what counts. Jam-adjacent genres (funk,
// bluegrass, reggae, psychedelic) are included on purpose: they're what the
// Peach Fest / Camp Bisco end of the scene actually books.
export const EDM_JAM_GENRES =
  /(dance\s*\/\s*electronic|electronic|\bedm\b|\bhouse\b|techno|trance|dubstep|drum\s*(?:&|and|n)\s*bass|\bdnb\b|bass music|\brave\b|hardstyle|breakbeat|\bjungle\b|downtempo|\bdisco\b|\bnu[- ]disco\b|jam\s*band|\bjam\b|improvisational|psychedelic|\bfunk\b|bluegrass|\bgroove\b|reggae|\bdub\b)/i;

/**
 * A multi-day event is exempt from the genre gate: that's the festival this
 * site exists for, and its billing is mixed by nature.
 *
 * Deliberately NOT name-based. Matching /festival/ on the title was tried and
 * is worse than useless here — the live queue contained "The Nu-Metal Values
 * Tribute Festival" and "Smoke on the Mountain - Wellness Festival", both
 * single-day, both of which a name test would have waved straight past the
 * genre gate. Promoters put "festival" on anything. A real multi-day run is
 * the honest signal.
 *
 * The span test is safe because the ticketing APIs list each night of a
 * residency as its own single-day event, so an end date later than the start
 * really does mean one multi-day event rather than a two-night booking.
 */
function isMultiDay(start?: string | null, end?: string | null): boolean {
  return !!start && !!end && end > start;
}

/**
 * Does any genre signal on this listing look like EDM or jam? `signals` is
 * whatever genre-ish text the source gave us (Ticketmaster classifications,
 * SeatGeek taxonomies and performer genres). No signal at all means no match:
 * an unclassified listing is far more often generic programming than a rave,
 * and everything here is auto-discovered rather than vouched for.
 */
function matchesGenre(signals: string[]): boolean {
  const text = signals.filter(Boolean).join(" ");
  return !!text.trim() && EDM_JAM_GENRES.test(text);
}

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
  source: EventSource;
  source_url?: string | null;
  // Set on seeds whose dates were extrapolated from a past year. Those go to
  // the review queue instead of straight onto the public page — a rolled-over
  // date is a good guess, not a fact, and publishing a wrong festival date is
  // worse than publishing nothing.
  estimated?: boolean;
};

type SeedEvent = IngestEvent & {
  // Recurs every year. When its stored occurrence has passed, the ingest
  // queues next year's estimate rather than letting the entry rot.
  annual?: boolean;
};

// Curated festivals within ~100mi of Nescopeck, PA. Dates are best-known and
// admin-editable on the review screen — treat them as a starting point, not
// gospel. These auto-approve because we vouch for them.
const SEED_EVENTS: SeedEvent[] = [
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
    annual: true,
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
    annual: true,
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
    annual: true,
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
    annual: true,
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
    annual: true,
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
    annual: true,
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
    annual: true,
  },
  {
    // Mirrors the row already live in the table, field for field, so the seed
    // refresh is a genuine no-op instead of overwriting the researched copy.
    // Its dedup_key must stay the canonical dedupKey() form — a hand-written
    // key here would insert a duplicate rather than match the existing row.
    name: "Karnival of the Arts",
    venue: "Kempton Community Center",
    city: "Kempton",
    region: "PA",
    start_date: "2026-09-03",
    end_date: "2026-09-07",
    lat: 40.6087,
    lng: -75.8571,
    description:
      "Four days of radical self-expression in the hills of Kempton — a triple-stage run of live music, visual art, dance and flow performance, plus immersive installations, workshops, carnival games, theme nights, fireworks and a Kids Zone. All ages.",
    source: "seed",
    source_url: "https://www.musicfestivalwizard.com/festivals/karnival-of-the-arts-2026/",
    annual: true,
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

// ── Garbage in, before it ever reaches the review queue ─────────────────────
// Ticketmaster and SeatGeek both list non-events alongside events: parking
// passes, hotel bundles, meet-and-greets, shuttle tickets. Left alone they bury
// the real finds in the pending queue, which is how a review screen stops being
// read. Same rule as the bug-report filter: false negatives are cheap (an admin
// hides one row), false positives are NOT (a real festival silently vanishes) —
// so every pattern here has to be unambiguous on its own.
const NOISE_PATTERNS: RegExp[] = [
  /^\s*parking\b/i,
  /\bparking (pass|lot|space)\b/i,
  /\b(hotel|travel|lodging) package\b/i,
  /\bvip (package|upgrade|experience|parking)\b/i,
  /\bmeet (&|and) greet\b/i,
  /\bshuttle (pass|ticket|service)\b/i,
  /\bpayment plan\b/i,
  /\bgift card\b/i,
  /\b(test|dummy) event\b/i,
];

function isNoise(name: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(name));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Shift a YYYY-MM-DD forward by whole years, keeping month/day. Feb 29 is
// clamped to Feb 28 in non-leap years — string math alone would produce
// "2029-02-29", which Postgres rejects and which would fail the whole insert.
function addYears(iso: string, years: number): string {
  const year = Number(iso.slice(0, 4)) + years;
  const monthDay = iso.slice(5);
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (monthDay === "02-29" && !isLeap(year)) return `${year}-02-28`;
  return `${year}-${monthDay}`;
}

// An annual seed whose occurrence has finished becomes next year's estimate.
// Returns null when the seed is still upcoming (nothing to do) or isn't annual.
function rollForward(seed: SeedEvent, today: string): SeedEvent | null {
  if (!seed.annual || !seed.start_date) return null;
  const finish = seed.end_date ?? seed.start_date;
  if (finish >= today) return null; // still ahead of us

  // How many whole years to add so the event lands in the future. Loops rather
  // than doing date math on Feb 29 — at most a couple of iterations.
  let years = 1;
  while (addYears(finish, years) < today && years < 10) years++;

  return {
    ...seed,
    start_date: addYears(seed.start_date, years),
    end_date: seed.end_date ? addYears(seed.end_date, years) : null,
    description: [seed.description, "Dates are estimated from the previous year — confirm before publishing."]
      .filter(Boolean)
      .join(" "),
    estimated: true,
  };
}

// ── Discovery source: Ticketmaster ──────────────────────────────────────────
// Free Discovery API. Two passes: everything classified as music in the radius,
// plus a "festival" keyword sweep that catches bills classified under arts or
// miscellaneous. Returns [] (never throws) if the key is missing or a call
// fails — discovery is best-effort; the curated seeds always run regardless.
async function fetchTicketmaster(): Promise<{ events: IngestEvent[]; offGenre: number }> {
  const key = process.env.TICKETMASTER_API_KEY;
  let offGenre = 0;
  if (!key) return { events: [], offGenre };

  const base = {
    apikey: key,
    latlong: `${REGION_CENTER.lat},${REGION_CENTER.lng}`,
    radius: String(REGION_RADIUS_MILES),
    unit: "miles",
    sort: "date,asc",
    size: String(PAGE_SIZE),
    startDateTime: `${todayISO()}T00:00:00Z`,
  };
  const passes: Record<string, string>[] = [
    { ...base, classificationName: "music" },
    { ...base, keyword: "festival" },
  ];

  const out: IngestEvent[] = [];
  for (const pass of passes) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ ...pass, page: String(page) });
      let data: Record<string, unknown>;
      try {
        const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
        if (!res.ok) {
          console.error("ticketmaster discovery failed:", res.status);
          break;
        }
        data = await res.json();
      } catch (e) {
        console.error("ticketmaster discovery error:", e);
        break;
      }

      const events = (data as { _embedded?: { events?: unknown[] } })?._embedded?.events ?? [];
      for (const raw of events) {
        const ev = raw as Record<string, never>;
        const name = String((ev as { name?: string })?.name || "").trim();
        if (!name) continue;
        const venue = (ev as { _embedded?: { venues?: Record<string, never>[] } })?._embedded?.venues?.[0] ?? {};
        const loc = (venue as { location?: { latitude?: string; longitude?: string } })?.location ?? {};
        const dates = (ev as { dates?: { start?: { localDate?: string }; end?: { localDate?: string } } })?.dates;
        const startDate = dates?.start?.localDate ?? null;
        const endDate = dates?.end?.localDate ?? dates?.start?.localDate ?? null;

        // Genre gate. Ticketmaster hands back segment/genre/subGenre per
        // listing ("Music" / "Dance/Electronic", "Music" / "Rock" / "Jam Band"),
        // which is what we match on. Festivals skip the gate entirely.
        if (!isMultiDay(startDate, endDate)) {
          const classes = ((ev as {
            classifications?: {
              segment?: { name?: string };
              genre?: { name?: string };
              subGenre?: { name?: string };
            }[];
          })?.classifications ?? []).flatMap((c) => [
            c?.genre?.name ?? "",
            c?.subGenre?.name ?? "",
          ]);
          if (!matchesGenre(classes)) {
            offGenre++;
            continue;
          }
        }

        out.push({
          name,
          venue: (venue as { name?: string })?.name ?? null,
          city: (venue as { city?: { name?: string } })?.city?.name ?? null,
          region:
            (venue as { state?: { stateCode?: string; name?: string } })?.state?.stateCode ??
            (venue as { state?: { name?: string } })?.state?.name ??
            null,
          start_date: startDate,
          end_date: endDate,
          lat: loc?.latitude ? Number(loc.latitude) : null,
          lng: loc?.longitude ? Number(loc.longitude) : null,
          description: null,
          source: "ticketmaster",
          source_url: (ev as { url?: string })?.url ?? null,
        });
      }

      // Last page reached — stop rather than burning quota on empty pages.
      const totalPages = (data as { page?: { totalPages?: number } })?.page?.totalPages ?? 1;
      if (events.length < PAGE_SIZE || page + 1 >= totalPages) break;
    }
  }
  return { events: out, offGenre };
}

// ── Discovery source: SeatGeek ──────────────────────────────────────────────
// Free Platform API (client_id only, no secret needed for reads). SeatGeek
// aggregates well beyond Ticketmaster's own box office, so it's the one most
// likely to surface an independent regional bill. Its catalog is mostly sports,
// so results are filtered down to music taxonomies before they're returned.
const MUSIC_TAXONOMY = /(concert|music|festival)/i;

async function fetchSeatGeek(): Promise<{ events: IngestEvent[]; offGenre: number }> {
  const clientId = process.env.SEATGEEK_CLIENT_ID;
  let offGenre = 0;
  if (!clientId) return { events: [], offGenre };

  const out: IngestEvent[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      client_id: clientId,
      lat: String(REGION_CENTER.lat),
      lon: String(REGION_CENTER.lng),
      range: `${REGION_RADIUS_MILES}mi`,
      "datetime_local.gte": todayISO(),
      per_page: String(PAGE_SIZE),
      page: String(page),
      sort: "datetime_local.asc",
    });

    let data: Record<string, unknown>;
    try {
      const res = await fetch(`https://api.seatgeek.com/2/events?${params}`);
      if (!res.ok) {
        console.error("seatgeek discovery failed:", res.status);
        break;
      }
      data = await res.json();
    } catch (e) {
      console.error("seatgeek discovery error:", e);
      break;
    }

    const events = (data as { events?: unknown[] })?.events ?? [];
    for (const raw of events) {
      const ev = raw as {
        title?: string;
        short_title?: string;
        datetime_local?: string;
        url?: string;
        taxonomies?: { name?: string }[];
        performers?: { genres?: { name?: string }[] }[];
        venue?: {
          name?: string;
          city?: string;
          state?: string;
          location?: { lat?: number; lon?: number };
        };
      };
      const name = String(ev.short_title || ev.title || "").trim();
      if (!name) continue;

      // Music only. SeatGeek's catalog is dominated by sports and theater;
      // without this the pending queue fills with Yankees games.
      const taxonomies = (ev.taxonomies ?? []).map((t) => t?.name ?? "").join(" ");
      if (!MUSIC_TAXONOMY.test(taxonomies)) continue;

      const day = (ev.datetime_local ?? "").slice(0, 10) || null;

      // Genre gate for individual shows. SeatGeek carries genres on the
      // performer rather than the event, so both are offered as signals.
      if (!isMultiDay(day, day)) {
        const genres = (ev.performers ?? []).flatMap((p) =>
          (p?.genres ?? []).map((g) => g?.name ?? "")
        );
        if (!matchesGenre([...genres, taxonomies])) {
          offGenre++;
          continue;
        }
      }
      out.push({
        name,
        venue: ev.venue?.name ?? null,
        city: ev.venue?.city ?? null,
        region: ev.venue?.state ?? null,
        start_date: day,
        end_date: day,
        lat: ev.venue?.location?.lat ?? null,
        lng: ev.venue?.location?.lon ?? null,
        description: null,
        source: "seatgeek",
        source_url: ev.url ?? null,
      });
    }

    if (events.length < PAGE_SIZE) break;
  }
  return { events: out, offGenre };
}

export type SourceReport = {
  name: string;
  configured: boolean;
  found: number;
};

export type IngestResult = {
  seeded: number;
  updated: number;
  discovered: number;
  skipped: number;
  archived: number;
  rolled: number;
  filtered: number;
  /** Individual shows dropped by the EDM/jam genre gate. Reported so a gate
   *  that's too tight shows up as a number rather than as a quiet empty page. */
  offGenre: number;
  discoverySource: string | null;
  sources: SourceReport[];
};

// Insert new rows, tolerating individual rejections. `local_events` carries a
// unique index on (name, city, start_date) as well as on dedup_key, so a single
// row that collides with something already in the table would abort an entire
// bulk INSERT and lose the whole night's discovery with it. The fast path is
// still one statement; only when that fails do we fall back to row-at-a-time so
// the offenders are the only thing dropped. Returns the rows actually written.
async function insertRows(
  admin: SupabaseClient,
  rows: Record<string, unknown>[]
): Promise<{ source: string; status: string }[]> {
  if (!rows.length) return [];

  const { error } = await admin.from("local_events").insert(rows);
  if (!error) return rows as { source: string; status: string }[];

  console.warn("local_events bulk insert failed, retrying individually:", error.message);
  const accepted: { source: string; status: string }[] = [];
  for (const row of rows) {
    const { error: rowError } = await admin.from("local_events").insert(row);
    if (rowError) console.warn("local_events row rejected:", row.dedup_key, rowError.message);
    else accepted.push(row as { source: string; status: string });
  }
  return accepted;
}

// Run the full ingest against a service-role client. Curated seeds are
// inserted (approved) or refreshed in place; discovered events are inserted as
// 'pending' only when brand new. Never disturbs an admin's status decisions.
export async function runLocalEventsIngest(admin: SupabaseClient): Promise<IngestResult> {
  const today = todayISO();

  // All discovery sources run concurrently — they're independent HTTP calls
  // and the cron has a 60s budget.
  const [tm, sg, venueEvents] = await Promise.all([
    fetchTicketmaster(),
    fetchSeatGeek(),
    fetchVenueFeeds(today),
  ]);
  const tmEvents = tm.events;
  const sgEvents = sg.events;
  const offGenre = tm.offGenre + sg.offGenre;

  const sources: SourceReport[] = [
    { name: "ticketmaster", configured: !!process.env.TICKETMASTER_API_KEY, found: tmEvents.length },
    { name: "seatgeek", configured: !!process.env.SEATGEEK_CLIENT_ID, found: sgEvents.length },
    // Venue calendars need no credential, so they're configured whenever the
    // watchlist isn't empty.
    { name: "venue calendars", configured: VENUE_FEEDS.length > 0, found: venueEvents.length },
  ];

  const rawDiscovered = [...tmEvents, ...sgEvents, ...venueEvents];
  const discovered = rawDiscovered.filter((e) => !isNoise(e.name));
  const filtered = rawDiscovered.length - discovered.length;

  // Annual seeds that have already happened get next year queued for review.
  const rolled: SeedEvent[] = [];
  for (const seed of SEED_EVENTS) {
    const next = rollForward(seed, today);
    if (next) rolled.push(next);
  }

  // Dedup incoming by key. Precedence: rolled-forward estimates beat raw seeds
  // (the raw one is the finished occurrence), and seeds beat discovery.
  const incoming = new Map<string, IngestEvent>();
  for (const e of discovered) incoming.set(dedupKey(e), e);
  for (const e of SEED_EVENTS) incoming.set(dedupKey(e), e);
  for (const e of rolled) incoming.set(dedupKey(e), e);

  const keys = [...incoming.keys()];
  const existing = new Set<string>();
  // Chunked: a wide discovery night can produce several hundred keys, and a
  // single .in() with all of them makes a URL long enough to be rejected.
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await admin
      .from("local_events")
      .select("dedup_key")
      .in("dedup_key", keys.slice(i, i + 200));
    for (const r of (data ?? []) as { dedup_key: string }[]) existing.add(r.dedup_key);
  }

  const result: IngestResult = {
    seeded: 0,
    updated: 0,
    discovered: 0,
    skipped: 0,
    archived: 0,
    rolled: 0,
    filtered,
    offGenre,
    discoverySource: sources.filter((s) => s.found > 0).map((s) => s.name).join(" + ") || null,
    sources,
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
      if (e.source === "seed" && !e.estimated) {
        // Refresh curated details but preserve the admin's status choice.
        const { name, venue, city, region, start_date, end_date, lat, lng, description, source_url } = row;
        await admin
          .from("local_events")
          .update({ name, venue, city, region, start_date, end_date, lat, lng, description, source_url })
          .eq("dedup_key", key);
        result.updated++;
      } else {
        result.skipped++; // already known → leave the admin's decision alone
      }
      continue;
    }

    // New row. Vouched-for seeds auto-approve; discovery and rolled-forward
    // date estimates go to the review queue.
    const autoApprove = e.source === "seed" && !e.estimated;
    toInsert.push({ ...row, status: autoApprove ? "approved" : "pending" });
  }

  // Counted from what the database actually accepted, not from what we intended
  // to send — see insertRows for why some rows can legitimately bounce.
  for (const row of await insertRows(admin, toInsert)) {
    if (row.source === "seed") {
      if (row.status === "approved") result.seeded++;
      else result.rolled++;
    } else {
      result.discovered++;
    }
  }

  // ── Garbage collection ──────────────────────────────────────────────────
  // Retire events that have already finished. Without this the list only ever
  // grows and silently rots: every seeded event carries a fixed year, so once
  // its dates pass /events shows nothing at all while the table still holds a
  // pile of finished festivals. (That is exactly the state this was found in —
  // 7 approved events, all past.)
  //
  // Archived, not deleted: the row is kept for history and the "venues we've
  // covered" list, and the public RLS policy only exposes status='approved',
  // so archiving removes it from the site the moment it runs.
  // Two passes because end_date is nullable: a single-day event stores only
  // start_date, and `end_date < today` never matches NULL — so filtering on
  // end_date alone would leave every one-day event behind forever.
  const multiDay = await admin
    .from("local_events")
    .update({ status: "archived", featured: false })
    .eq("status", "approved")
    .lt("end_date", today)
    .select("id");
  if (multiDay.error) console.error("local_events archive error:", multiDay.error.message);

  const singleDay = await admin
    .from("local_events")
    .update({ status: "archived", featured: false })
    .eq("status", "approved")
    .is("end_date", null)
    .lt("start_date", today)
    .select("id");
  if (singleDay.error) console.error("local_events archive error:", singleDay.error.message);

  result.archived = (multiDay.data?.length ?? 0) + (singleDay.data?.length ?? 0);

  // Stale pending rows are garbage too: a discovered event nobody reviewed
  // before it happened is never going to be useful. Sweep them so the review
  // queue stays a to-do list rather than an archaeological dig.
  const stalePending = await admin
    .from("local_events")
    .update({ status: "archived" })
    .eq("status", "pending")
    .not("start_date", "is", null)
    .lt("start_date", today)
    .select("id");
  if (stalePending.error) console.error("local_events pending sweep error:", stalePending.error.message);
  result.archived += stalePending.data?.length ?? 0;

  return result;
}
