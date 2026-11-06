"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapPoint = { lat: number; lng: number };

type Props = {
  token: string;
  /** The runner's live position (orange). */
  runner?: MapPoint | null;
  /** The customer's campsite (green). */
  site?: MapPoint | null;
  /** The customer's live position, when they chose to share it (purple). */
  customer?: MapPoint | null;
  /** The viewer's own position (blue). */
  me?: MapPoint | null;
  /** Pin-picker mode: the current choice, draggable. Set `onPick` to enable. */
  pick?: MapPoint | null;
  onPick?: (p: MapPoint) => void;
  /** Draw the way between two points: a walking path where one is mapped, else a straight line. */
  route?: { from: MapPoint; to: MapPoint } | null;
  height?: number;
  className?: string;
};

const COLORS = { runner: "#f97316", site: "#22c55e", customer: "#c084fc", me: "#60a5fa", pick: "#f97316" } as const;
type Key = keyof typeof COLORS;

/**
 * Map looks (owner, 2026-11-06): Satellite first — at a festival the real
 * fields, tents and tree lines are what people navigate by — Outdoors for
 * trails, woods and terrain contours, Dark as before. Remembered per device.
 */
const STYLES = {
  satellite: { label: "Satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" },
  outdoors: { label: "Outdoors", url: "mapbox://styles/mapbox/outdoors-v12" },
  dark: { label: "Dark", url: "mapbox://styles/mapbox/dark-v11" },
} as const;
type StyleKey = keyof typeof STYLES;
const STYLE_KEY = "ne_map_style";
// The chosen look lives in localStorage; read it the hydration-safe way (the
// server always renders Satellite, the phone then shows its saved choice).
const styleListeners = new Set<() => void>();
function readStyle(): StyleKey {
  try { const s = localStorage.getItem(STYLE_KEY); return s && s in STYLES ? (s as StyleKey) : "satellite"; } catch { return "satellite"; }
}
function saveStyle(k: StyleKey) {
  try { localStorage.setItem(STYLE_KEY, k); } catch { /* private mode: this map only */ }
  styleListeners.forEach((f) => f());
}
function subscribeStyle(f: () => void) { styleListeners.add(f); return () => { styleListeners.delete(f); }; }

type RouteInfo =
  | { kind: "walk"; meters: number; seconds: number }
  | { kind: "straight"; meters: number; bearing: string; noPath: boolean }
  | { kind: "here"; meters: number };

function meters(a: MapPoint, b: MapPoint) {
  const R = 6371000, r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function compass(a: MapPoint, b: MapPoint) {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(deg / 45) % 8];
}
function distanceText(m: number) {
  const ft = m * 3.28084;
  if (ft < 1000) return `${Math.round(ft / 10) * 10} ft (${Math.round(m)} m)`;
  return `${(m / 1609.34).toFixed(m < 16093 ? 2 : 1)} mi (${m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km"})`;
}

/**
 * One Mapbox GL map for the FestDash views: the customer's live track page,
 * the runner's console, and the campsite pin picker at checkout.
 *
 * mapbox-gl is imported on demand so pages without a token (or without a
 * location yet) never download it. Renders only when a token is passed; the
 * callers fall back to text otherwise. The walking path comes from Mapbox's
 * walking directions; most festival grounds have no mapped footpaths, so a
 * route that is missing or far longer than the straight line is replaced by
 * a dashed straight line with the distance and a compass direction.
 */
export default function LiveMap({
  token, runner, site, customer, me, pick, onPick, route, height = 260,
  className = "rounded-2xl border border-white/10",
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const libRef = useRef<typeof import("mapbox-gl") | null>(null);
  const markers = useRef<Partial<Record<Key, Marker>>>({});
  const framed = useRef(false);
  const userMoved = useRef(false);
  const picker = !!onPick;
  const styleKey = useSyncExternalStore(subscribeStyle, readStyle, () => "satellite" as StyleKey);
  const appliedStyle = useRef<StyleKey | null>(null);
  const [moved, setMoved] = useState(false);
  const [info, setInfo] = useState<RouteInfo | null>(null);
  const line = useRef<{ coords: number[][]; dashed: boolean } | null>(null);

  // Always-current props for callbacks that outlive a render.
  const latest = useRef({ runner, site, customer, me, pick });
  latest.current = { runner, site, customer, me, pick };
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const drawLine = (styleReady = false) => {
    const map = mapRef.current;
    if (!map || (!styleReady && !map.isStyleLoaded())) return;
    if (map.getLayer("ne-route")) map.removeLayer("ne-route");
    if (map.getSource("ne-route")) map.removeSource("ne-route");
    const l = line.current;
    if (!l) return;
    map.addSource("ne-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: l.coords } } });
    map.addLayer({
      id: "ne-route", type: "line", source: "ne-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#f97316", "line-width": 5, "line-opacity": 0.95, ...(l.dashed ? { "line-dasharray": [1.2, 1.6] } : {}) },
    });
  };

  const syncRef = useRef<() => void>(() => {});
  syncRef.current = () => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const cur = latest.current;

    const upsert = (key: Key, p: MapPoint | null | undefined, draggable = false) => {
      const existing = markers.current[key];
      if (!p) {
        existing?.remove();
        delete markers.current[key];
        return;
      }
      if (existing) {
        existing.setLngLat([p.lng, p.lat]);
        return;
      }
      const m = new lib.default.Marker({ color: COLORS[key], draggable })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      if (draggable) {
        m.on("dragend", () => {
          const ll = m.getLngLat();
          onPickRef.current?.({ lat: ll.lat, lng: ll.lng });
        });
      }
      markers.current[key] = m;
    };
    upsert("runner", cur.runner);
    upsert("site", cur.site);
    upsert("customer", cur.customer);
    upsert("me", cur.me);
    upsert("pick", cur.pick, true);

    const pts = [cur.runner, cur.site, cur.customer, cur.me, cur.pick].filter((p): p is MapPoint => !!p);
    if (pts.length === 0) return;
    // Keep the whole walking path in view, not just its two ends.
    if (!picker && line.current) for (const [lng, lat] of line.current.coords) pts.push({ lat, lng });
    if (picker) {
      // Never move the map under someone's finger while they place a pin:
      // frame the first point once, then leave the camera alone.
      if (!framed.current) {
        map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 15 });
        framed.current = true;
      }
      return;
    }
    // Once someone pans or zooms by hand, live updates stop moving the camera
    // until they tap "Re-centre".
    if (userMoved.current) return;
    if (pts.length === 1) {
      map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
    } else {
      const b = new lib.default.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat]);
      pts.forEach((p) => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: 56, maxZoom: 17, duration: 600 });
    }
  };

  // Create the map once per token / mode.
  useEffect(() => {
    if (!container.current || !token) return;
    let cancelled = false;
    import("mapbox-gl")
      .then((mod) => {
        if (cancelled || !container.current) return;
        const mapboxgl = mod.default;
        mapboxgl.accessToken = token;
        const c = latest.current;
        const first = c.pick ?? c.site ?? c.customer ?? c.runner ?? c.me;
        const map = new mapboxgl.Map({
          container: container.current,
          style: STYLES[(appliedStyle.current = readStyle())].url,
          center: first ? [first.lng, first.lat] : [-96, 38],
          zoom: first ? 15 : 3,
          // Two-finger pan inside a scrolling page, except when placing a pin.
          cooperativeGestures: !picker,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        if (picker) {
          map.getCanvas().style.cursor = "crosshair";
          map.on("click", (e) => onPickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
        }
        const byHand = (e: unknown) => {
          if ((e as { originalEvent?: unknown }).originalEvent && !picker) { userMoved.current = true; setMoved(true); }
        };
        map.on("dragstart", byHand);
        map.on("zoomstart", byHand);
        // A new look drops added layers; draw the route again.
        map.on("style.load", () => drawLine(true));
        map.on("load", () => {
          if (cancelled) return;
          libRef.current = mod;
          mapRef.current = map;
          // A look chosen while the map was still loading.
          const want = readStyle();
          if (appliedStyle.current !== want) { appliedStyle.current = want; map.setStyle(STYLES[want].url); }
          syncRef.current();
          drawLine();
        });
      })
      .catch((e) => console.error("mapbox-gl failed to load:", e));
    return () => {
      cancelled = true;
      Object.values(markers.current).forEach((m) => m?.remove());
      markers.current = {};
      mapRef.current?.remove();
      mapRef.current = null;
      libRef.current = null;
      framed.current = false;
    };
  }, [token, picker]);

  function chooseStyle(k: StyleKey) {
    saveStyle(k);
  }
  // Apply the chosen look (a tap here, or one saved on this phone earlier).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyle.current === styleKey) return;
    appliedStyle.current = styleKey;
    map.setStyle(STYLES[styleKey].url);
  }, [styleKey]);

  // Move markers / reframe whenever a position changes.
  useEffect(() => {
    syncRef.current();
  }, [runner?.lat, runner?.lng, site?.lat, site?.lng, customer?.lat, customer?.lng, me?.lat, me?.lng, pick?.lat, pick?.lng]);

  // The way between the two route points. Asked again only when an end has
  // moved 25 m or a minute has passed, so a walking runner doesn't spend the
  // Mapbox allowance on every GPS tick.
  const asked = useRef<{ from: MapPoint; to: MapPoint; at: number } | null>(null);
  const fromLat = route?.from.lat, fromLng = route?.from.lng, toLat = route?.to.lat, toLng = route?.to.lng;
  useEffect(() => {
    if (fromLat == null || fromLng == null || toLat == null || toLng == null || !token) {
      line.current = null; asked.current = null; drawLine();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing derived route info when the route goes away
      setInfo(null);
      return;
    }
    const from = { lat: fromLat, lng: fromLng }, to = { lat: toLat, lng: toLng };
    const prev = asked.current;
    if (prev && meters(prev.from, from) < 25 && meters(prev.to, to) < 25 && Date.now() - prev.at < 60000) return;
    asked.current = { from, to, at: Date.now() };
    const straight = meters(from, to);
    const straightLine = (noPath: boolean) => {
      line.current = { coords: [[from.lng, from.lat], [to.lng, to.lat]], dashed: true };
      setInfo({ kind: "straight", meters: straight, bearing: compass(from, to), noPath });
      drawLine();
    };
    if (straight < 25) { line.current = null; drawLine(); setInfo({ kind: "here", meters: straight }); return; }
    const ctrl = new AbortController();
    let answered = false;
    fetch(`https://api.mapbox.com/directions/v5/mapbox/walking/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        answered = true;
        const r0 = j?.routes?.[0];
        // No path, or a detour far longer than walking straight there: festival
        // fields and campgrounds rarely have mapped footpaths.
        if (!r0?.geometry?.coordinates?.length || r0.distance > Math.max(straight * 2.2, straight + 600)) return straightLine(true);
        // Mapbox starts and ends the path at the nearest mapped path or road;
        // join each end to its pin so the line reaches both people.
        line.current = { coords: [[from.lng, from.lat], ...(r0.geometry.coordinates as number[][]), [to.lng, to.lat]], dashed: false };
        setInfo({ kind: "walk", meters: r0.distance, seconds: r0.duration });
        drawLine();
        syncRef.current(); // frame the whole route
      })
      .catch((e) => { if ((e as Error).name !== "AbortError") { answered = true; straightLine(true); } });
    // A position update before Mapbox answered cancels this request — forget
    // it, so the next run asks again instead of skipping as "already asked".
    return () => { if (!answered) { ctrl.abort(); asked.current = null; } };
    // drawLine reads refs only.
  }, [fromLat, fromLng, toLat, toLng, token]);

  function recentre() {
    userMoved.current = false;
    setMoved(false);
    syncRef.current();
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="relative w-full" style={{ height }}>
        {/* Explicit 100% size: mapbox-gl's own CSS sets .mapboxgl-map to
            position: relative, which cancels absolute/inset sizing and left the
            map 0 px tall (black box) — caught on 2026-11-06 before anyone used it. */}
        <div ref={container} style={{ width: "100%", height: "100%" }} role="img" aria-label="Map" />
        <div className="absolute left-2 top-2 z-10 flex overflow-hidden rounded-lg border border-white/20 bg-black/70 text-[11px] font-semibold backdrop-blur" role="radiogroup" aria-label="Map look">
          {(Object.keys(STYLES) as StyleKey[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={styleKey === k} onClick={() => chooseStyle(k)}
              className={`px-2.5 py-1.5 transition ${styleKey === k ? "bg-white text-black" : "text-neutral-200 hover:bg-white/10"}`}>
              {STYLES[k].label}
            </button>
          ))}
        </div>
        {moved && !picker && (
          <button type="button" onClick={recentre}
            className="absolute bottom-2 left-2 z-10 rounded-lg border border-white/20 bg-black/75 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
            ◎ Re-centre
          </button>
        )}
      </div>
      {info && (
        <p className="border-t border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-300">
          {info.kind === "walk" && <>🚶 <span className="font-semibold text-white">{distanceText(info.meters)}</span> on a walking path · about {Math.max(1, Math.round(info.seconds / 60))} min</>}
          {info.kind === "straight" && <>📍 <span className="font-semibold text-white">{distanceText(info.meters)}</span> away, to the <span className="font-semibold text-white">{info.bearing}</span> · no mapped footpath here, so the dashed line is straight across</>}
          {info.kind === "here" && <>📍 Within about {Math.round(info.meters * 3.28084)} ft — look around</>}
        </p>
      )}
    </div>
  );
}
