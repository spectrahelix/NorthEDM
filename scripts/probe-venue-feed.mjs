#!/usr/bin/env node
// Can this venue be automated?
//
//   node scripts/probe-venue-feed.mjs https://www.somevenue.com
//
// Checks all three readers the ingest supports:
//   1. The Events Calendar REST API (WordPress) — what most regional arts
//      centers and small venues turn out to run.
//   2. schema.org JSON-LD Event / MusicEvent markup — what custom-built venue
//      sites publish for search engines. Checked on the homepage and the usual
//      calendar paths.
//   3. A dice.fm venue page — pass a https://dice.fm/venue/<slug> URL. Use this
//      for clubs that publish nothing of their own, which is most EDM rooms.
//      Find the slug by searching the published venue sitemaps:
//        node scripts/probe-venue-feed.mjs --find "noto"
//
// Prints what it found and a ready-to-paste VENUE_FEEDS entry for
// utils/venueFeeds.ts. Run this BEFORE adding a venue. A site that fails both
// can't be automated — its shows go in through the manual "Add an event" form
// on /admin/events.

const UA = "NorthEDM-EventBot/1.0 (+https://northedm.com/events)";
const JSONLD_PATHS = ["/", "/events", "/calendar", "/shows", "/schedule"];
const EVENT_TYPE = /(^|[^a-z])(Music)?Event$|Festival/i;

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/probe-venue-feed.mjs <site-url>");
  console.error("       node scripts/probe-venue-feed.mjs --find <venue name>");
  process.exit(1);
}

// --find: search Dice's published venue sitemaps for a venue slug. Slugs carry
// no location, so matches from other cities are expected — probe one to see.
if (input === "--find") {
  const needle = process.argv.slice(3).join(" ").trim().toLowerCase();
  if (!needle) {
    console.error("usage: node scripts/probe-venue-feed.mjs --find <venue name>");
    process.exit(1);
  }
  const re = new RegExp(needle.replace(/[^a-z0-9]+/g, "[-a-z0-9]*"), "i");
  const hits = [];
  process.stdout.write(`Searching Dice's venue sitemaps for "${needle}" `);
  for (let i = 1; i <= 40; i++) {
    let text;
    try {
      const res = await fetch(`https://dice.fm/sitemaps/venues/sitemap${i}.xml`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) break; // ran past the last sitemap
      text = await res.text();
    } catch {
      break;
    }
    for (const m of text.matchAll(/<loc>([^<]+)<\/loc>/g)) if (re.test(m[1])) hits.push(m[1]);
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 250)); // be a polite guest
  }
  console.log(`\n\n${hits.length} match${hits.length === 1 ? "" : "es"}:`);
  for (const h of hits) console.log(`  ${h}`);
  console.log(`\nProbe one to confirm its city:\n  node scripts/probe-venue-feed.mjs <url>`);
  process.exit(0);
}

const origin = new URL(input.startsWith("http") ? input : `https://${input}`).origin;
const today = new Date().toISOString().slice(0, 10);

function decode(s = "") {
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

async function get(url, accept) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

console.log(`Probing ${origin} …\n`);

// ── Reader 3 (checked first when the URL says so): dice.fm venue page ───────
if (/(^|\.)dice\.fm$/i.test(new URL(input.startsWith("http") ? input : `https://${input}`).hostname)) {
  const path = new URL(input.startsWith("http") ? input : `https://${input}`).pathname;
  let profile;
  try {
    const res = await get(origin + path, "text/html");
    const html = await res.text();
    const block = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!block) throw new Error("no __NEXT_DATA__ payload");
    profile = JSON.parse(block[1])?.props?.pageProps?.profile;
    if (!profile) throw new Error("no venue profile in payload");
  } catch (e) {
    console.log(`❌ Not a readable Dice venue page (${e.message}).`);
    console.log(`   Expected something like https://dice.fm/venue/<slug>.`);
    process.exit(0);
  }

  const venue = profile.venue ?? {};
  const events = (profile.sections ?? []).flatMap((s) => s.events ?? []);
  console.log(`✅ Dice venue page is readable.`);
  console.log(`   "${venue.name ?? "?"}" — ${venue.city?.name ?? "?"}`);
  console.log(`   ${venue.address ?? "(no address)"}`);
  console.log(`   ${events.length} upcoming event${events.length === 1 ? "" : "s"}\n`);

  for (const e of events.slice(0, 5)) {
    console.log(`     ${String(e.dates?.event_start_date ?? "?").slice(0, 16)}  ${decode(e.name ?? "")}  [${e.status ?? "?"}]`);
  }

  const loc = venue.city?.location ?? {};
  console.log(`\n   Paste into VENUE_FEEDS in utils/venueFeeds.ts:\n`);
  console.log(`  {
    label: ${JSON.stringify(decode(venue.name ?? ""))},
    origin: "https://dice.fm",
    city: ${JSON.stringify(venue.city?.name ?? "")},
    region: "PA", // set from the address above — Dice gives city, not state
    lat: ${loc.lat ?? 0}, // city-level from Dice; refine to the venue if you can
    lng: ${loc.lng ?? 0},
    kind: "dice",
    path: ${JSON.stringify(path)},
  },`);
  console.log(`\n   ⚠  Dice is read from __NEXT_DATA__, an internal Next.js payload rather`);
  console.log(`      than a documented API. It can change without notice. Prefer a venue's`);
  console.log(`      own JSON-LD when it has any.`);
  process.exit(0);
}

// ── Reader 1: The Events Calendar ───────────────────────────────────────────
let tec = null;
try {
  const res = await get(
    `${origin}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`,
    "application/json"
  );
  tec = await res.json();
} catch (e) {
  console.log(`   The Events Calendar API: no (${e.message})`);
}

if (tec) {
  const events = tec.events ?? [];
  console.log(`✅ The Events Calendar API is live.`);
  console.log(`   ${tec.total ?? "?"} upcoming events, ${tec.total_pages ?? "?"} pages of 50.\n`);

  if (!events.length) {
    console.log("   …but nothing is scheduled from today onward. Recheck in season.");
    process.exit(0);
  }

  const categories = new Map();
  for (const e of events)
    for (const c of e.categories ?? []) {
      const name = decode(c.name);
      categories.set(name, (categories.get(name) ?? 0) + 1);
    }

  console.log("   Categories in the next 50 events:");
  if (categories.size === 0) {
    console.log("     (none — the ingest's non-show denylist will filter locally)");
  } else {
    for (const [name, n] of [...categories].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${String(n).padStart(3)}  ${name}`);
    }
  }

  const sample = events[0];
  const venue = sample.venue ?? {};
  console.log(`\n   Sample: "${decode(sample.title)}"`);
  console.log(`           ${sample.start_date} @ ${decode(venue.venue) || "(no venue on the event)"} ${venue.city ?? ""} ${venue.state ?? ""}`);

  const musicCategory = [...categories.keys()].find((c) => /concert|music|live/i.test(c));
  console.log(`\n   Paste into VENUE_FEEDS in utils/venueFeeds.ts:\n`);
  console.log(`  {
    label: ${JSON.stringify(decode(venue.venue) || new URL(origin).hostname)},
    origin: ${JSON.stringify(origin)},
    city: ${JSON.stringify(venue.city ?? "")},
    region: ${JSON.stringify(venue.state ?? "PA")},
    lat: 0, // fill these in — without them the card shows no weather strip
    lng: 0,${musicCategory ? `\n    categories: [${JSON.stringify(musicCategory)}],` : ""}
    maxPages: ${Math.min(tec.total_pages ?? 1, 2)},
  },`);

  if (!musicCategory && categories.size > 0) {
    console.log(`\n   No music-specific category to request server-side, so it's left off`);
    console.log(`   and the ingest filters locally. Check the list above for the right name.`);
  }
  process.exit(0);
}

// ── Reader 2: schema.org JSON-LD ────────────────────────────────────────────
function collect(html) {
  const found = [];
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    let parsed;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node["@graph"])) stack.push(...node["@graph"]);
      const types = [].concat(node["@type"] ?? []).map(String);
      if (types.some((t) => EVENT_TYPE.test(t))) found.push(node);
    }
  }
  return found;
}

let best = null;
for (const path of JSONLD_PATHS) {
  try {
    const res = await get(origin + path, "text/html");
    const events = collect(await res.text());
    if (events.length && (!best || events.length > best.events.length)) {
      best = { path, events };
    }
  } catch {
    /* a missing path is normal, keep trying the others */
  }
}

if (!best) {
  console.log(`   schema.org JSON-LD events: none on ${JSONLD_PATHS.join(", ")}`);
  console.log(`\n❌ Nothing readable on the venue's own site — its calendar is probably`);
  console.log(`   rendered by JavaScript.`);
  console.log(`\n   Try Dice before giving up. Most EDM clubs sell there and publish`);
  console.log(`   nothing themselves, which is exactly how they stay invisible to the`);
  console.log(`   ticketing APIs:`);
  console.log(`     node scripts/probe-venue-feed.mjs --find "<venue name>"`);
  console.log(`\n   If that finds nothing either, add its shows by hand at /admin/events.`);
  process.exit(0);
}

console.log(`✅ schema.org JSON-LD: ${best.events.length} events on ${best.path}\n`);

const sample = best.events[0];
const place = sample.location ?? {};
const address = place.address ?? {};
const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(String(sample.startDate ?? ""));

console.log(`   Sample: "${decode(sample.name ?? "")}"`);
console.log(`           ${sample.startDate} @ ${decode(place.name ?? "?")} ${address.addressLocality ?? ""} ${address.addressRegion ?? ""}`);
console.log(
  zoned
    ? `   ⚠  Timestamps carry a timezone, so they're instants — the reader converts\n      them to the venue's local date. A 1:30am UTC door time is the PREVIOUS\n      evening in Eastern. Set timeZone if this venue isn't America/New_York.`
    : `   Timestamps carry no zone, so they're read as local wall time.`
);

console.log(`\n   Paste into VENUE_FEEDS in utils/venueFeeds.ts:\n`);
console.log(`  {
    label: ${JSON.stringify(decode(place.name ?? new URL(origin).hostname))},
    origin: ${JSON.stringify(origin)},
    city: ${JSON.stringify(address.addressLocality ?? "")},
    region: ${JSON.stringify(address.addressRegion ?? "PA")},
    lat: 0, // fill these in — without them the card shows no weather strip
    lng: 0,
    kind: "jsonld",
    path: ${JSON.stringify(best.path)},
  },`);

console.log(`\n   Check robots.txt allows this path before adding it:`);
console.log(`     ${origin}/robots.txt`);
