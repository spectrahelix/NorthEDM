#!/usr/bin/env node
/**
 * Studio product photo from the command line — the agent's half of the shop's
 * "Studio" photo step (app/components/vendor/PhotoStudio.tsx). Same model and
 * same pixel code (utils/productStudio/*), so the result matches what a shop
 * owner gets in the browser.
 *
 *   node scripts/product-photo.mjs grid <photo> [--out grid.png]
 *       The photo with a labelled 50 px grid, to read tap coordinates from.
 *
 *   node scripts/product-photo.mjs make <photo> --tap X,Y [--tap X,Y] [--not X,Y]
 *        [--backdrop sand] [--out shot.jpg]
 *       Smart-select the product at the tap(s), cut it out, put it on the
 *       backdrop. --not marks something that is NOT the product (a hand).
 *       Also writes <out>.select.png: the photo with everything outside the
 *       selection dimmed — look at it to check nothing was missed or added.
 *
 *   node scripts/product-photo.mjs backdrops
 *       List backdrop ids.
 *
 * Coordinates are pixels of the photo as stored (EXIF rotation applied).
 * Uploading is a separate, deliberate step — see .claude/skills/product-photo.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as tf from "@huggingface/transformers";
import { BACKDROPS, backdropById, DEFAULT_BACKDROP } from "../utils/productStudio/backdrops.ts";
import { cleanMask, composeStudio, STUDIO_SIZE } from "../utils/productStudio/compose.ts";
import { loadSam, prepare, maskFor } from "../utils/productStudio/segment.ts";

const [cmd, file, ...rest] = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const all = (name) => rest.flatMap((v, i) => (rest[i - 1] === name ? [v] : []));
const xy = (s) => { const [x, y] = s.split(",").map(Number); if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Bad point "${s}" — use X,Y`); return { x, y }; };
const MAX_EDGE = 1600; // same cap as utils/webImage.ts

async function load(path) {
  const { data, info } = await sharp(path).rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), W: info.width, H: info.height };
}

async function grid(path, out) {
  mkdirSync(dirname(out), { recursive: true });
  const { rgba, W, H } = await load(path);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  for (let x = 0; x < W; x += 50) svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${x % 100 ? "#0ff" : "#f00"}" stroke-opacity="0.7" stroke-width="1"/>`;
  for (let y = 0; y < H; y += 50) svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${y % 100 ? "#0ff" : "#f00"}" stroke-opacity="0.7" stroke-width="1"/>`;
  for (let x = 0; x < W; x += 100) for (let y = 0; y < H; y += 100)
    svg += `<text x="${x + 2}" y="${y + 11}" font-size="11" font-family="monospace" fill="#ff0" stroke="#000" stroke-width="0.3">${x},${y}</text>`;
  svg += "</svg>";
  await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.length), { raw: { width: W, height: H, channels: 4 } })
    .composite([{ input: Buffer.from(svg) }]).png().toFile(out);
  console.log(`${out}  (${W}×${H})`);
}

async function make(path) {
  const taps = [...all("--tap").map((s) => ({ ...xy(s), add: true })), ...all("--not").map((s) => ({ ...xy(s), add: false }))];
  const { rgba, W, H } = await load(path);
  if (!taps.some((t) => t.add)) taps.push({ x: W / 2, y: H / 2, add: true }); // centre, like the browser's first guess
  const backdrop = backdropById(opt("--backdrop") ?? DEFAULT_BACKDROP);
  const out = opt("--out") ?? path.replace(/\.[^.]+$/, "") + `-studio-${backdrop.id}.jpg`;

  mkdirSync(dirname(out), { recursive: true });
  const sam = await loadSam(tf);
  const rgb = new Uint8ClampedArray(W * H * 3);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = rgba[i * 4]; rgb[i * 3 + 1] = rgba[i * 4 + 1]; rgb[i * 3 + 2] = rgba[i * 4 + 2]; }
  const prepared = await prepare(sam, new tf.RawImage(rgb, W, H, 3));
  const { mask, score } = await maskFor(prepared, taps);
  const alpha = cleanMask(mask, W, H, taps.filter((t) => t.add), rgba);

  // Selection check: outside dimmed and tinted, taps marked.
  const sel = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const a = alpha[i] / 255;
    sel[i * 4] = rgba[i * 4] * (0.25 + 0.75 * a) + 60 * (1 - a);
    sel[i * 4 + 1] = rgba[i * 4 + 1] * (0.25 + 0.75 * a);
    sel[i * 4 + 2] = rgba[i * 4 + 2] * (0.25 + 0.75 * a) + 60 * (1 - a);
    sel[i * 4 + 3] = 255;
  }
  const dots = taps.map((t) => `<circle cx="${t.x}" cy="${t.y}" r="9" fill="${t.add ? "#39FF14" : "#FF5C3A"}" stroke="#000" stroke-width="2"/>`).join("");
  const selOut = out.replace(/\.[^.]+$/, "") + ".select.png";
  await sharp(Buffer.from(sel.buffer), { raw: { width: W, height: H, channels: 4 } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${dots}</svg>`) }])
    .png().toFile(selOut);

  const shot = composeStudio({ rgba, W, H, alpha, backdrop });
  await sharp(Buffer.from(shot.buffer), { raw: { width: STUDIO_SIZE, height: STUDIO_SIZE, channels: 4 } })
    .removeAlpha().jpeg({ quality: 88 }).toFile(out);
  console.log(`${out}\n${selOut}\nmodel confidence ${score.toFixed(2)} · backdrop ${backdrop.id} · taps ${JSON.stringify(taps)}`);
}

try {
  if (cmd === "grid" && file) await grid(file, opt("--out") ?? file.replace(/\.[^.]+$/, "") + "-grid.png");
  else if (cmd === "make" && file) await make(file);
  else if (cmd === "backdrops") for (const b of BACKDROPS) console.log(`${b.id.padEnd(10)} ${b.label}`);
  else { console.log("Usage: product-photo.mjs grid <photo> | make <photo> --tap X,Y [--not X,Y] [--backdrop id] [--out f.jpg] | backdrops"); process.exit(1); }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
