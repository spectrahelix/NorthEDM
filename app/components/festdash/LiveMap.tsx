"use client";
import { useEffect, useRef } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapPoint = { lat: number; lng: number };

type Props = {
  token: string;
  /** The runner's live position (orange). */
  runner?: MapPoint | null;
  /** The customer's campsite (green). */
  site?: MapPoint | null;
  /** The viewer's own position (blue) — the runner's console. */
  me?: MapPoint | null;
  /** Pin-picker mode: the current choice, draggable. Set `onPick` to enable. */
  pick?: MapPoint | null;
  onPick?: (p: MapPoint) => void;
  height?: number;
  className?: string;
};

const COLORS = { runner: "#f97316", site: "#22c55e", me: "#60a5fa", pick: "#f97316" } as const;
type Key = keyof typeof COLORS;

/**
 * One Mapbox GL map for the three FestDash views: the customer's live track
 * page, the runner's console, and the campsite pin picker at checkout.
 *
 * mapbox-gl is imported on demand so pages without a token (or without a
 * location yet) never download it. Renders only when a token is passed; the
 * callers fall back to text otherwise.
 */
export default function LiveMap({
  token, runner, site, me, pick, onPick, height = 260,
  className = "rounded-2xl border border-white/10",
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const libRef = useRef<typeof import("mapbox-gl") | null>(null);
  const markers = useRef<Partial<Record<Key, Marker>>>({});
  const framed = useRef(false);
  const picker = !!onPick;

  // Always-current props for callbacks that outlive a render.
  const latest = useRef({ runner, site, me, pick });
  latest.current = { runner, site, me, pick };
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

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
    upsert("me", cur.me);
    upsert("pick", cur.pick, true);

    const pts = [cur.runner, cur.site, cur.me, cur.pick].filter((p): p is MapPoint => !!p);
    if (pts.length === 0) return;
    if (picker) {
      // Never move the map under someone's finger while they place a pin:
      // frame the first point once, then leave the camera alone.
      if (!framed.current) {
        map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 15 });
        framed.current = true;
      }
      return;
    }
    if (pts.length === 1) {
      map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
    } else {
      const b = new lib.default.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat]);
      pts.forEach((p) => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: 56, maxZoom: 16, duration: 600 });
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
        const first = c.pick ?? c.site ?? c.runner ?? c.me;
        const map = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/dark-v11",
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
        map.on("load", () => {
          if (cancelled) return;
          libRef.current = mod;
          mapRef.current = map;
          syncRef.current();
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

  // Move markers / reframe whenever a position changes.
  useEffect(() => {
    syncRef.current();
  }, [runner?.lat, runner?.lng, site?.lat, site?.lng, me?.lat, me?.lng, pick?.lat, pick?.lng]);

  return (
    <div
      ref={container}
      className={`w-full overflow-hidden ${className}`}
      style={{ height }}
      role="img"
      aria-label="Map"
    />
  );
}
