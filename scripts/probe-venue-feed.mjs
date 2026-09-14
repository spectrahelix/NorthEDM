#!/usr/bin/env node
// Can this venue be automated?
//
//   node scripts/probe-venue-feed.mjs https://www.somevenue.com
//
// Checks whether a site publishes a machine-readable event calendar we can
// ingest — specifically WordPress's "The Events Calendar" REST API, which is
// what most small venues and arts centers in the region turn out to run. Prints
// the event count, the categories in use, and a ready-to-paste VENUE_FEEDS
// entry for utils/venueFeeds.ts.
//
// Run this BEFORE adding a venue to the watchlist. A site that fails here can't
// be automated and needs the manual "Add an event" form in /admin/events.

const UA = "NorthEDM-EventBot/1.0 (+https://northedm.com/events)";
const input = process.argv[2];

if (!input) {
  console.error("usage: node scripts/probe-venue-feed.mjs <site-url>");
  process.exit(1);
}

const origin = new URL(input.startsWith("http") ? input : `https://${input}`).origin;
const today = new Date().toISOString().slice(0, 10);

function decode(s = "") {
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

async function api(params) {
  const res = await fetch(`${origin}/wp-json/tribe/events/v1/events?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

console.log(`Probing ${origin} …\n`);

let all;
try {
  all = await api(`per_page=50&start_date=${today}`);
} catch (e) {
  console.log(`❌ No Events Calendar API here (${e.message}).`);
  console.log(`   This venue can't be automated — add its shows by hand at /admin/events.`);
  process.exit(0);
}

const events = all.events ?? [];
console.log(`✅ The Events Calendar API is live.`);
console.log(`   ${all.total ?? "?"} upcoming events, ${all.total_pages ?? "?"} pages of 50.\n`);

if (!events.length) {
  console.log("   …but nothing is scheduled from today onward. Recheck in season.");
  process.exit(0);
}

const categories = new Map();
for (const e of events) for (const c of e.categories ?? []) {
  const name = decode(c.name);
  categories.set(name, (categories.get(name) ?? 0) + 1);
}

console.log("   Categories in the next 50 events:");
if (categories.size === 0) {
  console.log("     (none — events aren't categorised, so the music filter will run locally)");
} else {
  for (const [name, n] of [...categories].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(3)}  ${name}`);
  }
}

const sample = events[0];
const venue = sample.venue ?? {};
console.log(`\n   Sample: "${decode(sample.title)}"`);
console.log(`           ${sample.start_date} @ ${decode(venue.venue) || "(no venue on the event)"} ${venue.city ?? ""} ${venue.state ?? ""}`);
if (!venue.city) {
  console.log(`   ⚠  Events carry no venue/city. Set city/region/lat/lng on the feed entry.`);
}

const musicCategory = [...categories.keys()].find((c) => /concert|music|live/i.test(c));
console.log(`\n   Paste into VENUE_FEEDS in utils/venueFeeds.ts:\n`);
console.log(`  {
    label: ${JSON.stringify(decode(venue.venue) || new URL(origin).hostname)},
    origin: ${JSON.stringify(origin)},
    city: ${JSON.stringify(venue.city ?? "")},
    region: ${JSON.stringify(venue.state ?? "PA")},
    lat: 0, // fill these in — without them the card shows no weather strip
    lng: 0,${musicCategory ? `\n    categories: [${JSON.stringify(musicCategory)}],` : ""}
    maxPages: ${Math.min(all.total_pages ?? 1, 2)},
  },`);

if (!musicCategory && categories.size > 0) {
  console.log(`\n   No music-ish category found. Left off deliberately: the ingest will`);
  console.log(`   filter locally instead. Check the list above for the right name first.`);
}
