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
   * How to read this venue.
   *   "events-calendar" (default) — WordPress's The Events Calendar REST API.
   *   "jsonld" — schema.org Event/MusicEvent objects embedded in a page. Plenty
   *     of custom-built venue sites publish these even though they run no CMS
   *     we recognise; it's the same structured data Google reads.
   *   "dice" — a dice.fm venue page. For the rooms that publish nothing at all
   *     of their own; see the DICE note below.
   */
  kind?: "events-calendar" | "jsonld" | "dice";
  /** For kind "jsonld"/"dice": the page carrying the data. Defaults to "/". */
  path?: string;
  /**
   * IANA zone for interpreting event timestamps. Only matters for "jsonld",
   * where times often arrive as UTC instants — a 1:30am UTC door time is
   * 9:30pm the PREVIOUS evening in Eastern, so without this every late show at
   * a nightclub lands on /events a day late.
   */
  timeZone?: string;
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
  {
    // ── Read via dice.fm ──────────────────────────────────────────────────
    // NOTO and Warehouse on Watts are two of Philadelphia's main EDM rooms and
    // neither can be read from its own site: NOTO publishes no structured data
    // and Warehouse on Watts wasn't reachable at all. Ticketmaster has neither,
    // because Dice sells their tickets — which is the whole reason this gap
    // existed. See the DICE note above fetchDiceFeed().
    label: "NOTO Nightclub",
    origin: "https://dice.fm",
    city: "Philadelphia",
    region: "PA",
    lat: 39.9564,
    lng: -75.1580,
    kind: "dice",
    path: "/venue/noto-nightclub-nvvyq",
  },
  {
    label: "Warehouse on Watts",
    origin: "https://dice.fm",
    city: "Philadelphia",
    region: "PA",
    lat: 39.9707,
    lng: -75.1510,
    kind: "dice",
    path: "/venue/warehouse-on-watts-dede",
  },
  {
    // Philadelphia EDM room — touring headliners, themed raves, afterparties.
    // Outside the NEPA discovery radius on purpose: the watchlist is curated by
    // hand, not filtered by distance, so a venue worth covering is covered
    // regardless of how tight the automated geo sweep is set.
    //
    // No CMS we recognise, but it publishes schema.org MusicEvent markup on its
    // homepage. robots.txt allows "/" (only /admin/ and /api/ are disallowed)
    // and it serves our own bot user-agent a full page, so nothing here depends
    // on pretending to be a browser.
    label: "The Ave Live",
    origin: "https://theavelive.com",
    city: "Philadelphia",
    region: "PA",
    lat: 39.9612,
    lng: -75.1387,
    kind: "jsonld",
    path: "/",
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
// Dice lists pass/bundle products in the same feed as shows ("All Access Party
// Pass"). Narrow on purpose — anything less specific risks eating a real event.
const NON_SHOW_TITLE = /\ball[- ]access (party )?pass\b/i;

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

// ── Reader: schema.org JSON-LD ──────────────────────────────────────────────
// Many venue sites run no CMS we can query but still embed schema.org Event /
// MusicEvent objects for search engines. That's a documented, stable contract —
// far sturdier than parsing their HTML — so we read the same markup Google does.

const EVENT_TYPE = /(^|[^a-z])(Music)?Event$|Festival/i;

/**
 * The calendar date an event falls on, in the venue's own timezone.
 *
 * A timestamp carrying a zone (…Z or ±hh:mm) is an instant, and slicing its
 * first ten characters gives the UTC date, which is wrong for anything after
 * 8pm Eastern: a club show stamped 2026-09-19T01:30:00Z actually happens on the
 * evening of the 18th. A timestamp with no zone is already local wall time and
 * is taken as-is.
 */
export function localDate(iso: string, timeZone: string): string | null {
  const value = String(iso || "").trim();
  if (!value) return null;
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    const plain = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(plain) ? plain : null;
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  // en-CA formats as YYYY-MM-DD, which is exactly the shape the column wants.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

type JsonLdEvent = {
  "@type"?: unknown;
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: { name?: string; address?: { addressLocality?: string; addressRegion?: string } };
  offers?: { url?: string } | { url?: string }[];
};

// Walk every ld+json block, flattening arrays and @graph containers, and return
// the nodes that describe an event.
function collectJsonLdEvents(html: string): JsonLdEvent[] {
  const found: JsonLdEvent[] = [];
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue; // a malformed block is not a reason to abandon the page
    }
    const stack: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      if (Array.isArray(record["@graph"])) stack.push(...(record["@graph"] as unknown[]));
      const types = ([] as unknown[]).concat(record["@type"] ?? []).map(String);
      if (types.some((t) => EVENT_TYPE.test(t))) found.push(record as JsonLdEvent);
    }
  }
  return found;
}

async function fetchJsonLdFeed(feed: VenueFeed, today: string): Promise<IngestEvent[]> {
  const url = `${feed.origin}${feed.path ?? "/"}`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`venue feed ${feed.label} returned ${res.status}`);
      return [];
    }
    html = await res.text();
  } catch (e) {
    console.warn(`venue feed ${feed.label} failed:`, e instanceof Error ? e.message : e);
    return [];
  }

  const zone = feed.timeZone ?? "America/New_York";
  const out: IngestEvent[] = [];
  for (const ev of collectJsonLdEvents(html)) {
    const name = decodeEntities(String(ev.name ?? "")).trim();
    const start = localDate(String(ev.startDate ?? ""), zone);
    // Past events are dropped here rather than relying on the nightly sweep:
    // a page like this lists its whole back catalogue.
    if (!name || !start || start < today) continue;
    const end = ev.endDate ? localDate(String(ev.endDate), zone) : null;
    const offer = Array.isArray(ev.offers) ? ev.offers[0] : ev.offers;
    out.push({
      name,
      venue: ev.location?.name ? decodeEntities(ev.location.name) : feed.label,
      city: feed.city || ev.location?.address?.addressLocality || null,
      region: feed.region || ev.location?.address?.addressRegion || null,
      start_date: start,
      end_date: end && end >= start ? end : start,
      lat: feed.lat ?? null,
      lng: feed.lng ?? null,
      description: ev.description ? toPlainText(String(ev.description)) : null,
      source: "venue",
      source_url: ev.url || offer?.url || feed.origin,
    });
  }
  return out;
}

// ── Reader: dice.fm venue pages ─────────────────────────────────────────────
//
// WHY THIS EXISTS. Ticketmaster and SeatGeek index what they sell, and EDM
// clubs almost never sell through either — they sell through Dice. A coverage
// check of Philadelphia's dedicated EDM rooms found ZERO of them in the
// Ticketmaster sweep, so for the genre this site is actually about, the
// ticketing APIs are close to useless. Dice is where that scene lives.
//
// ACCESS. dice.fm/robots.txt gives `User-agent: *` an `Allow: /` with only
// `/api/` disallowed, and declares `Content-Signal: search=yes, ai-train=no,
// use=reference` — which is what a linked, attributed event listing is. It does
// disallow several named AI crawlers (ClaudeBot, GPTBot, CCBot…); those target
// model-training crawlers, and this is NorthEDM's own aggregator identifying
// itself honestly as NorthEDM-EventBot. The site owner reviewed that
// distinction and authorised this. We touch only public venue pages and the
// published sitemaps, never `/api/`, once per venue per night, and every card
// links back to Dice.
//
// FRAGILITY — READ BEFORE DEBUGGING. Unlike The Events Calendar (a documented
// REST API) and JSON-LD (a published schema), `__NEXT_DATA__` is Next.js's
// internal SSR payload. It is not a contract and can change or vanish with any
// Dice deploy — if they move to the App Router it becomes `self.__next_f` and
// this reader goes quiet. That is why it fails soft and logs loudly rather than
// throwing: a silent zero here means "check whether Dice changed", not "no
// events". Prefer a venue's own JSON-LD whenever it has some (The Ave Live is
// read from its own site for exactly this reason, even though Dice also has it).
type DiceEvent = {
  id?: string;
  name?: string;
  status?: string;
  dates?: {
    timezone?: string;
    event_start_date?: string;
    event_end_date?: string;
    is_multi_days_event?: boolean;
  };
  venues?: {
    name?: string;
    city?: { name?: string; location?: { lat?: number; lng?: number } };
  }[];
};

async function fetchDiceFeed(feed: VenueFeed, today: string): Promise<IngestEvent[]> {
  const url = `${feed.origin}${feed.path ?? "/"}`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`dice feed ${feed.label} returned ${res.status}`);
      return [];
    }
    html = await res.text();
  } catch (e) {
    console.warn(`dice feed ${feed.label} failed:`, e instanceof Error ? e.message : e);
    return [];
  }

  const block = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!block) {
    console.warn(`dice feed ${feed.label}: no __NEXT_DATA__ payload — Dice's page shape likely changed`);
    return [];
  }

  let sections: { events?: DiceEvent[] }[];
  try {
    const parsed = JSON.parse(block[1]) as {
      props?: { pageProps?: { profile?: { sections?: { events?: DiceEvent[] }[] } } };
    };
    sections = parsed.props?.pageProps?.profile?.sections ?? [];
  } catch (e) {
    console.warn(`dice feed ${feed.label}: unparseable payload:`, e instanceof Error ? e.message : e);
    return [];
  }

  const out: IngestEvent[] = [];
  for (const section of sections) {
    for (const ev of section.events ?? []) {
      const name = decodeEntities(String(ev.name ?? "")).trim();
      if (!name || NON_SHOW_TITLE.test(name)) continue;
      // A cancelled show shouldn't reach the review queue; sold-out still
      // happens, so it stays — people want to know it's on.
      if (/cancel|postpon/i.test(ev.status ?? "")) continue;

      // Dice stamps offsets ("2026-09-18T22:00:00-04:00") and names the venue's
      // own zone, so use that rather than assuming Eastern.
      const zone = ev.dates?.timezone || feed.timeZone || "America/New_York";
      const start = localDate(String(ev.dates?.event_start_date ?? ""), zone);
      if (!start || start < today) continue;

      // A club night ends at 2am the NEXT day. Taking event_end_date at face
      // value would render every single show as a two-day event, so the feed's
      // own multi-day flag decides.
      const end = ev.dates?.is_multi_days_event
        ? localDate(String(ev.dates?.event_end_date ?? ""), zone) ?? start
        : start;

      const venue = ev.venues?.[0];
      out.push({
        name,
        venue: venue?.name ? decodeEntities(venue.name) : feed.label,
        city: feed.city || venue?.city?.name || null,
        region: feed.region || null,
        start_date: start,
        end_date: end >= start ? end : start,
        lat: feed.lat ?? venue?.city?.location?.lat ?? null,
        lng: feed.lng ?? venue?.city?.location?.lng ?? null,
        description: null,
        source: "venue",
        source_url: ev.id ? `https://dice.fm/event/${ev.id}` : url,
      });
    }
  }
  return out;
}

/**
 * Pull every configured venue calendar. Feeds run concurrently and failures are
 * contained per-feed, so this resolves to whatever succeeded — never throws.
 */
export async function fetchVenueFeeds(today: string): Promise<IngestEvent[]> {
  const batches = await Promise.all(
    VENUE_FEEDS.map((feed) =>
      feed.kind === "dice"
        ? fetchDiceFeed(feed, today)
        : feed.kind === "jsonld"
          ? fetchJsonLdFeed(feed, today)
          : fetchFeed(feed, today)
    )
  );
  return batches.flat().slice(0, GLOBAL_CAP);
}
