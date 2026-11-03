// The chart wheel as an SVG string — one drawing for the screen and the PDF.
// Built only from the calculated longitudes. Ascendant on the left, zodiac
// counter-clockwise; without a birth time 0° Aries sits on the left and
// planets whose sign is uncertain are left off.
// The Sun is drawn as a shape (circle + dot): its ☉ glyph is missing from
// the small symbol font the PDF embeds.

import { SIGNS, SIGN_GLYPHS, BODY_GLYPHS, type BodyName } from "./zodiac.ts";

export type WheelInput = {
  ascendant: { longitude: number } | null;
  midheaven: { longitude: number } | null;
  placements: Array<{ body: BodyName; longitude: number | null; label: string }>;
};

const TXT = "︎"; // text presentation, never emoji
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function wheelSvg(w: WheelInput, opts: { color?: string; accent?: string; font?: string } = {}): string {
  const color = opts.color ?? "currentColor";
  const accent = opts.accent ?? "#a78bfa";
  const font = opts.font ? ` font-family="${esc(opts.font)}"` : "";
  const size = 340, c = size / 2;
  const rOuter = 160, rSigns = 132, rInner = 110, rPlanets = 88;
  const asc = w.ascendant?.longitude ?? 0;
  const pt = (lon: number, r: number): [number, number] => {
    const th = ((180 + (lon - asc)) * Math.PI) / 180;
    return [r2(c + r * Math.cos(th)), r2(c - r * Math.sin(th))];
  };
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -14 ${size + 28} ${size + 28}" role="img" aria-label="Birth chart wheel" style="display:block;width:100%;max-width:340px;height:auto;margin:0 auto"${font}>`);
  out.push(`<circle cx="${c}" cy="${c}" r="${rOuter}" fill="none" stroke="${color}" stroke-opacity="0.5"/>`);
  out.push(`<circle cx="${c}" cy="${c}" r="${rInner}" fill="none" stroke="${color}" stroke-opacity="0.5"/>`);
  SIGNS.forEach((s, i) => {
    const [x1, y1] = pt(i * 30, rInner), [x2, y2] = pt(i * 30, rOuter), [gx, gy] = pt(i * 30 + 15, rSigns + 2);
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-opacity="0.4"/>`);
    out.push(`<text x="${gx}" y="${gy}" font-size="16" text-anchor="middle" dominant-baseline="central" fill="${color}">${SIGN_GLYPHS[i]}${TXT}<title>${s}</title></text>`);
  });
  if (w.ascendant) {
    const [x1, y1] = pt(asc, 0), [x2, y2] = pt(asc, rOuter + 6);
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${accent}" stroke-width="1.5"/>`);
    out.push(`<text x="${x2 - 4}" y="${y2 - 6}" font-size="10" text-anchor="end" fill="${accent}">ASC</text>`);
  }
  if (w.ascendant && w.midheaven) {
    const [m0x, m0y] = pt(w.midheaven.longitude, 0), [mx, my] = pt(w.midheaven.longitude, rOuter + 6);
    out.push(`<line x1="${m0x}" y1="${m0y}" x2="${mx}" y2="${my}" stroke="${accent}" stroke-dasharray="3 3"/>`);
    out.push(`<text x="${mx}" y="${my - 4}" font-size="10" text-anchor="middle" fill="${accent}">MC</text>`);
  }
  const placed = w.placements.filter((p) => p.longitude != null).map((p) => ({ ...p, lon: p.longitude as number })).sort((a, b) => a.lon - b.lon);
  for (let i = 0, ring = 0; i < placed.length; i++) {
    ring = i > 0 && placed[i].lon - placed[i - 1].lon < 7 ? ring + 1 : 0;
    const p = placed[i];
    const r = rPlanets - (ring % 3) * 18;
    const [x, y] = pt(p.lon, r), [tx, ty] = pt(p.lon, rInner), [tx2, ty2] = pt(p.lon, rInner - 6);
    out.push(`<line x1="${tx}" y1="${ty}" x2="${tx2}" y2="${ty2}" stroke="${color}"/>`);
    const title = `<title>${esc(`${p.body} ${p.label}`)}</title>`;
    if (p.body === "Sun") {
      out.push(`<g>${title}<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${color}" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="1.4" fill="${color}"/></g>`);
    } else {
      out.push(`<text x="${x}" y="${y}" font-size="15" text-anchor="middle" dominant-baseline="central" fill="${color}">${BODY_GLYPHS[p.body]}${TXT}${title}</text>`);
    }
  }
  out.push(`</svg>`);
  return out.join("");
}
