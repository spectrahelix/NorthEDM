// Chart wheel drawn from the calculated longitudes only — the same numbers as
// the tables. Ascendant on the left; the zodiac runs counter-clockwise.
// Without a birth time there is no Ascendant, so 0° Aries sits on the left and
// planets whose sign is uncertain are left off the wheel.

import { SIGN_GLYPHS, SIGNS } from "@/utils/numerology/zodiac";
import type { AstrologyResult } from "@/utils/numerology/astrology";

const TXT = "︎"; // text presentation, not emoji

export function AstroChartWheel({ astro }: { astro: Extract<AstrologyResult, { status: "available" }> }) {
  const size = 340;
  const c = size / 2;
  const rOuter = 160, rSigns = 132, rInner = 110, rPlanets = 88;
  const asc = astro.ascendant?.longitude ?? 0;
  const pt = (lon: number, r: number) => {
    const th = ((180 + (lon - asc)) * Math.PI) / 180;
    return [c + r * Math.cos(th), c - r * Math.sin(th)] as const;
  };

  // Spread planets that sit close together.
  const placed = astro.placements
    .filter((p) => p.longitude != null)
    .map((p) => ({ ...p, lon: p.longitude as number }))
    .sort((a, b) => a.lon - b.lon);
  const marks: Array<(typeof placed)[number] & { r: number }> = [];
  for (let i = 0, ring = 0; i < placed.length; i++) {
    ring = i > 0 && placed[i].lon - placed[i - 1].lon < 7 ? ring + 1 : 0;
    marks.push({ ...placed[i], r: rPlanets - (ring % 3) * 18 });
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block h-auto w-full max-w-[340px]" role="img" aria-label="Birth chart wheel">
      <circle cx={c} cy={c} r={rOuter} fill="none" stroke="currentColor" strokeOpacity="0.5" />
      <circle cx={c} cy={c} r={rInner} fill="none" stroke="currentColor" strokeOpacity="0.5" />
      {SIGNS.map((s, i) => {
        const [x1, y1] = pt(i * 30, rInner);
        const [x2, y2] = pt(i * 30, rOuter);
        const [gx, gy] = pt(i * 30 + 15, rSigns + 2);
        return (
          <g key={s}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.4" />
            <text x={gx} y={gy} fontSize="16" textAnchor="middle" dominantBaseline="central" fill="currentColor">
              {SIGN_GLYPHS[i] + TXT}
              <title>{s}</title>
            </text>
          </g>
        );
      })}
      {astro.ascendant && (() => {
        const [x1, y1] = pt(asc, 0);
        const [x2, y2] = pt(asc, rOuter + 6);
        const mc = astro.midheaven?.longitude;
        return (
          <g>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a78bfa" strokeWidth="1.5" />
            <text x={x2 - 4} y={y2 - 6} fontSize="10" textAnchor="end" fill="#a78bfa">ASC</text>
            {mc != null && (() => {
              const [mx, my] = pt(mc, rOuter + 6);
              const [m0x, m0y] = pt(mc, 0);
              return (
                <>
                  <line x1={m0x} y1={m0y} x2={mx} y2={my} stroke="#a78bfa" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={mx} y={my - 4} fontSize="10" textAnchor="middle" fill="#a78bfa">MC</text>
                </>
              );
            })()}
          </g>
        );
      })()}
      {marks.map((p) => {
        const [x, y] = pt(p.lon, p.r);
        const [tx, ty] = pt(p.lon, rInner);
        const [tx2, ty2] = pt(p.lon, rInner - 6);
        return (
          <g key={p.body}>
            <line x1={tx} y1={ty} x2={tx2} y2={ty2} stroke="currentColor" />
            <text x={x} y={y} fontSize="15" textAnchor="middle" dominantBaseline="central" fill="currentColor">
              {p.glyph + TXT}
              <title>{`${p.body} ${p.label}`}</title>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
