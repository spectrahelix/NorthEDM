import type { IngestEvent } from "./localEvents";

// Venue calendar feeds — where the smaller shows actually live.
//
// Ticketmaster and SeatGeek only index what sells through a box office they're
// plugged into. A 200-cap room, a community arts center, a farm stage: none of
// those appear, no matter how wide the radius. What a lot of them DO have is
// WordPress running "The Events Calendar", which ships a public REST API at
// /wp-json/tribe/events/v1/events with clean, structured, paginated data —
// title, dates, venue, city, state, categories, link.
//
// So this source reads venues' own calendars directly. Each entry below was
// verified to answer that endpoint with in-region events; run
// `node scripts/probe-venue-feed.mjs <site-url>` before adding another.
//
// Nothing here is scraped: it's a documented JSON API, fetched once nightly,
// with an identifying User-Agent and a link back to the venue on every card.

export type VenueFeed = {
  /** Fallback venue name when the feed's own event omits one. */
  label: string;
  /** Site root. The Events Calendar API is assumed at /wp-json/tribe/events/v1. */
  origin: string;
  city: string;
  region: string;
  lat?: number;
  lng?: number;
  /**
   * Categories to request from the feed. Filtering server-side is the
   * difference between 63 music events and 590 rows of film screenings, gallery
   * shows and drawing classes burying the review queue. Omit to pull everything
   * and filter locally against NON_SHOW_CATEGORY.
   */
  categories?: string[];
  /** Hard ceiling on pages pulled per night. 1 page = 50 events. */
  maxPages?: number;
};

export const VENUE_FEEDS: VenueFeed[] = [
  {
    // ArtsQuest runs SteelStacks, the Levitt Pavilion and Musikfest off one
    // install — steelstacks.org, artsquest.org and musikfest.org are the same
    // 590-event calendar, so it's listed once. Their "Concerts" category is
    // well maintained, which cuts it to the ~60 we actually want.
    label: "SteelStacks",
    origin: "https://www.steelstacks.org",
    city: "Bethlehem",
    region: "PA",
    lat: 40.6154,
    lng: -75.3679,
    categories: ["Concerts"],
    maxPages: 2,
  },
  {
    // Small calendar with no music-specific category to request, so it's pulled
    // whole and filtered locally. Broadway, comedy and dance bills all count as
    // regional shows; only the non-performance programming is dropped.
    label: "Scranton Cultural Center",
    origin: "https://www.scrantonculturalcenter.org",
    city: "Scranton",
    region: "PA",
    lat: 41.4098,
    lng: -75.6624,
    maxPages: 1,
  },
];

// Categories that mean "this isn't a show." Applied only to feeds that don't
// declare their own `categories`.
//
// This is a denylist rather than an allowlist on purpose. Every venue in
// VENUE_FEEDS was hand-picked, so the default assumption is that what's on its
// calendar belongs on /events — a comedy night or a dance company at the
// Scranton Cultural Center is still a regional show. An allowlist of music
// words was tried first and threw away most of a curated venue's calendar to
// avoid a handful of gallery listings, which is the wrong trade. What genuinely
// doesn't belong is the non-performance programming these buildings also run:
// film screenings, standing exhibitions, classes, building tours.
const NON_SHOW_CATEGORY =
  /(film|movie|screening|exhibit|gallery|class|workshop|lecture|tour|meeting|fundrais|volunteer)/i;

const UA = "NorthEDM-EventBot/1.0 (+https://northedm.com/events)";
const PER_PAGE = 50;
const FETCH_TIMEOUT_MS = 12_000;
// Ceiling across all feeds combined. The review queue is only useful if a human
// will actually read it; a night that somehow produced 400 rows would end that.
const GLOBAL_CAP = 120;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

// WordPress serves titles HTML-encoded — "Jim Henson&#8217;s Fraggle Rock".
// Stored raw, that string is what a festival-goer reads on the card.
export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function safeCodePoint(n: number): string {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

function toPlainText(html: string, maxLength = 300): string {
  const text = decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  // Cut on a word boundary so the blurb doesn't end mid-word.
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, "")}…`;
}

type TecEvent = {
  title?: string;
  description?: string;
  excerpt?: string;
  url?: string;
  start_date?: string;
  end_date?: string;
  categories?: { name?: string }[];
  tags?: { name?: string }[];
  venue?: { venue?: string; city?: string; state?: string; geo_lat?: unknown; geo_lng?: unknown };
};

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

async function fetchFeed(feed: VenueFeed, today: string): Promise<IngestEvent[]> {
  const out: IngestEvent[] = [];
  const pages = feed.maxPages ?? 1;

  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      per_page: String(PER_PAGE),
      page: String(page),
      start_date: today,
    });
    if (feed.categories?.length) params.set("categories", feed.categories.join(","));

    let events: TecEvent[];
    try {
      const res = await fetch(`${feed.origin}/wp-json/tribe/events/v1/events?${params}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        // 404 once a venue redesigns off WordPress is the expected way a feed
        // dies. Log it and move on — one dead venue must not fail the night.
        console.warn(`venue feed ${feed.label} returned ${res.status}`);
        break;
      }
      const json = (await res.json()) as { events?: TecEvent[] };
      events = json?.events ?? [];
    } catch (e) {
      console.warn(`venue feed ${feed.label} failed:`, e instanceof Error ? e.message : e);
      break;
    }

    for (const ev of events) {
      const name = decodeEntities(String(ev.title ?? "")).trim();
      const start = (ev.start_date ?? "").slice(0, 10);
      if (!name || !start) continue;

      // Drop non-performance programming, only where the feed hasn't already
      // filtered for us. An uncategorised event is kept — this is a curated
      // venue, so the benefit of the doubt goes to the show, and anything that
      // slips through is one click to hide in review.
      if (!feed.categories?.length) {
        const labels = decodeEntities(
          [...(ev.categories ?? []), ...(ev.tags ?? [])].map((c) => c?.name ?? "").join(" ")
        );
        if (NON_SHOW_CATEGORY.test(labels)) continue;
      }

      const end = (ev.end_date ?? "").slice(0, 10) || start;
      out.push({
        name,
        // Venue name comes from the event (the Weinberg Theatre is more useful
        // than "Scranton Cultural Center"), but city/region come from the
        // curated entry — feeds hand back values like "SCRANTON".
        venue: ev.venue?.venue ? decodeEntities(ev.venue.venue) : feed.label,
        city: feed.city || (ev.venue?.city ? decodeEntities(ev.venue.city) : null),
        region: feed.region || ev.venue?.state || null,
        start_date: start,
        end_date: end < start ? start : end,
        lat: num(ev.venue?.geo_lat) ?? feed.lat ?? null,
        lng: num(ev.venue?.geo_lng) ?? feed.lng ?? null,
        description: toPlainText(ev.excerpt || ev.description || ""),
        source: "venue",
        source_url: ev.url ?? feed.origin,
      });
    }

    if (events.length < PER_PAGE) break; // last page
  }
  return out;
}

/**
 * Pull every configured venue calendar. Feeds run concurrently and failures are
 * contained per-feed, so this resolves to whatever succeeded — never throws.
 */
export async function fetchVenueFeeds(today: string): Promise<IngestEvent[]> {
  const batches = await Promise.all(VENUE_FEEDS.map((feed) => fetchFeed(feed, today)));
  return batches.flat().slice(0, GLOBAL_CAP);
}
