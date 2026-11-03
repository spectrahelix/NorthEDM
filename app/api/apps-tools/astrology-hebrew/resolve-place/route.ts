import { NextResponse } from "next/server";
import tzlookup from "@photostructure/tz-lookup";
import { clientIp, overRateLimit, recordAttempt } from "@/utils/botSignals";

// Birthplace search: OpenStreetMap's Nominatim for coordinates, then the IANA
// time zone for those coordinates (offline, tz-lookup). Nominatim's usage
// policy: identify the app, stay under ~1 request/second, credit OSM, cache.
// The page only searches when the person presses Search.

const BUCKET = "apps-tools-place";
const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 120) {
    return NextResponse.json({ error: "Type a town and state or country." }, { status: 400 });
  }
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body);

  const ip = clientIp(req.headers);
  if (await overRateLimit(BUCKET, ip, { max: 40, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many place searches. Try again in a few minutes." }, { status: 429 });
  }

  let rows: Array<{ display_name: string; lat: string; lon: string; addresstype?: string }>;
  try {
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "jsonv2", limit: "6" })}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "NorthEDM/1.0 (+https://northedm.com/apps-and-tools)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    rows = await res.json();
  } catch {
    return NextResponse.json({ error: "Place search is unavailable right now. Try again shortly." }, { status: 502 });
  }
  await recordAttempt(BUCKET, ip);

  const results = rows
    .map((r) => {
      const lat = Number(r.lat), lon = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      let zone: string;
      try { zone = tzlookup(lat, lon); } catch { return null; }
      return { label: r.display_name, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, zone };
    })
    .filter(Boolean);
  const body = { results, attribution: "© OpenStreetMap contributors" };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return NextResponse.json(body);
}
