/**
 * Studio product photos, the pixel half: tidy a segmentation mask and place
 * the cut-out product on a backdrop. Pure functions over RGBA arrays — no
 * canvas, no DOM, no Node APIs — so the shop's photo upload (PhotoStudio) and
 * the agent skill (scripts/product-photo.mjs) produce the same picture.
 *
 * Imports use `.ts` extensions so Node can run this file directly.
 */
import type { Backdrop } from "./backdrops.ts";

export type Seed = { x: number; y: number };

/** Separable box blur, radius r, in place on a copy. Three passes ≈ Gaussian. */
export function blur(src: Float32Array, W: number, H: number, r: number, passes = 3): Float32Array {
  const a = Float32Array.from(src);
  if (r < 1) return a;
  const b = new Float32Array(W * H);
  const n = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {           // horizontal
      const row = y * W;
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[row + Math.min(W - 1, Math.max(0, i))];
      for (let x = 0; x < W; x++) {
        b[row + x] = s / n;
        s += a[row + Math.min(W - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {           // vertical
      let s = 0;
      for (let i = -r; i <= r; i++) s += b[Math.min(H - 1, Math.max(0, i)) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s / n;
        s += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x];
      }
    }
  }
  return a;
}

/** Flood-fill `on` cells reachable from the given starts. */
function flood(on: Uint8Array, W: number, H: number, starts: number[]): Uint8Array {
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  for (const s of starts) if (on[s] && !seen[s]) { seen[s] = 1; stack.push(s); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W, y = (i - x) / W;
    if (x > 0 && on[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
    if (x < W - 1 && on[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && on[i - W] && !seen[i - W]) { seen[i - W] = 1; stack.push(i - W); }
    if (y < H - 1 && on[i + W] && !seen[i + W]) { seen[i + W] = 1; stack.push(i + W); }
  }
  return seen;
}

/** Largest connected `on` region. */
function largest(on: Uint8Array, W: number, H: number): Uint8Array {
  const label = new Int32Array(W * H);
  let best = 0, bestSize = 0, next = 0;
  const stack: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!on[s] || label[s]) continue;
    next++; let size = 0;
    label[s] = next; stack.push(s);
    while (stack.length) {
      const i = stack.pop()!; size++;
      const x = i % W, y = (i - x) / W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && on[j] && !label[j]) { label[j] = next; stack.push(j); }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = label[i] === best && best ? 1 : 0;
  return out;
}

/**
 * Edge-aware smoothing (He, Sun & Tang's guided filter, grey guide): the mask
 * keeps its shape but its edge moves onto the nearest real colour boundary in
 * the photo. The model's mask is computed on a 256×256 grid, so on its own the
 * outline of a straight-edged box wobbles by several pixels.
 */
function guided(p: Float32Array, rgba: ArrayLike<number>, W: number, H: number, r: number, eps: number): Float32Array {
  const n = W * H;
  const I = new Float32Array(n), II = new Float32Array(n), Ip = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
    I[i] = g; II[i] = g * g; Ip[i] = g * p[i];
  }
  const mI = blur(I, W, H, r, 1), mp = blur(p, W, H, r, 1), mII = blur(II, W, H, r, 1), mIp = blur(Ip, W, H, r, 1);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = mII[i] - mI[i] * mI[i];
    a[i] = (mIp[i] - mI[i] * mp[i]) / (v + eps);
    b[i] = mp[i] - a[i] * mI[i];
  }
  const ma = blur(a, W, H, r, 1), mb = blur(b, W, H, r, 1);
  const q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = ma[i] * I[i] + mb[i];
  return q;
}

/**
 * Turn a raw model mask (any non-zero = product) into a clean alpha channel:
 * keep only the region(s) the person tapped (stray blobs elsewhere go), fill
 * holes inside the product (printed artwork the model wasn't sure of), snap
 * the edge to the photo's real outline when the photo is given, smooth what
 * wobble is left, and feather a pixel or two so it doesn't look cut with
 * scissors. Returns 0–255 alpha, W×H.
 */
export function cleanMask(
  mask: ArrayLike<number>, W: number, H: number, seeds: Seed[] = [], rgba?: ArrayLike<number>,
): Uint8ClampedArray {
  let on: Uint8Array = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) on[i] = mask[i] ? 1 : 0;

  const starts = seeds
    .map((s) => Math.round(Math.min(H - 1, Math.max(0, s.y))) * W + Math.round(Math.min(W - 1, Math.max(0, s.x))))
    .filter((i) => on[i]);
  on = starts.length ? flood(on, W, H, starts) : largest(on, W, H);

  // Holes: background not reachable from the picture's border is inside the product.
  const off = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) off[i] = on[i] ? 0 : 1;
  const border: number[] = [];
  for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1);
  const outside = flood(off, W, H, border);
  let f: Float32Array = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = outside[i] ? 0 : 1;

  const side = Math.max(W, H);
  if (rgba) f = guided(f, rgba, W, H, Math.max(4, Math.round(side * 0.008)), 1e-4);

  // Smooth the outline (blur + threshold), then feather.
  const smooth = blur(f, W, H, Math.max(1, Math.round(side * 0.0015)));
  for (let i = 0; i < W * H; i++) smooth[i] = smooth[i] >= 0.5 ? 1 : 0;
  const soft = blur(smooth, W, H, Math.max(1, Math.round(side * 0.0010)), 2);
  const alpha = new Uint8ClampedArray(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = Math.round(soft[i] * 255);
  return alpha;
}

/** Bounding box of alpha above a small threshold, or null if empty. */
export function alphaBox(alpha: ArrayLike<number>, W: number, H: number) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha[y * W + x] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export const STUDIO_SIZE = 1200;

/**
 * The finished studio shot: a `size`×`size` square (the site's product shape —
 * see ImageCropper) with the backdrop gradient, a soft drop shadow, and the
 * product centred, filling `fill` of the square on its longer side. Never
 * enlarged past 2.5× its source pixels, so a tiny photo stays sharp-ish and
 * simply sits smaller. Returns opaque RGBA, size×size×4.
 */
export function composeStudio(opts: {
  rgba: ArrayLike<number>; W: number; H: number;
  alpha: ArrayLike<number>; backdrop: Backdrop;
  size?: number; fill?: number;
}): Uint8ClampedArray {
  const { rgba, W, H, alpha, backdrop } = opts;
  const size = opts.size ?? STUDIO_SIZE;
  const fill = opts.fill ?? 0.78;
  const out = new Uint8ClampedArray(size * size * 4);

  // Backdrop.
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = backdrop.top[0] * (1 - t) + backdrop.bottom[0] * t;
    const g = backdrop.top[1] * (1 - t) + backdrop.bottom[1] * t;
    const b = backdrop.top[2] * (1 - t) + backdrop.bottom[2] * t;
    for (let x = 0; x < size; x++) { const o = (y * size + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
  }

  const box = alphaBox(alpha, W, H);
  if (!box) return out;
  const scale = Math.min((size * fill) / box.w, (size * fill) / box.h, 2.5);
  const dw = box.w * scale, dh = box.h * scale;
  const dx = (size - dw) / 2, dy = (size - dh) / 2 - size * 0.015;

  // Bilinear sample of source channel c (0–3 rgba, 4 = alpha) at source coords.
  const sample = (sx: number, sy: number, c: number) => {
    const x0 = Math.max(0, Math.min(W - 1, Math.floor(sx))), y0 = Math.max(0, Math.min(H - 1, Math.floor(sy)));
    const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, sx - x0)), fy = Math.max(0, Math.min(1, sy - y0));
    const v = (x: number, y: number) => (c === 4 ? alpha[y * W + x] : rgba[(y * W + x) * 4 + c]);
    return (v(x0, y0) * (1 - fx) + v(x1, y0) * fx) * (1 - fy) + (v(x0, y1) * (1 - fx) + v(x1, y1) * fx) * fy;
  };

  // Product alpha laid out in the square, used for the shadow and the paste.
  const placed = new Float32Array(size * size);
  const X0 = Math.floor(dx), X1 = Math.ceil(dx + dw), Y0 = Math.floor(dy), Y1 = Math.ceil(dy + dh);
  for (let y = Math.max(0, Y0); y < Math.min(size, Y1); y++) {
    for (let x = Math.max(0, X0); x < Math.min(size, X1); x++) {
      const sx = box.x + (x + 0.5 - dx) / scale - 0.5, sy = box.y + (y + 0.5 - dy) / scale - 0.5;
      if (sx < box.x - 1 || sy < box.y - 1 || sx > box.x + box.w || sy > box.y + box.h) continue;
      placed[y * size + x] = sample(sx, sy, 4) / 255;
    }
  }

  // Shadow: the silhouette, nudged down-right, blurred, darkening the backdrop.
  const off = new Float32Array(size * size);
  const ox = Math.round(size * 0.014), oy = Math.round(size * 0.022);
  for (let y = 0; y < size - oy; y++) for (let x = 0; x < size - ox; x++) off[(y + oy) * size + x + ox] = placed[y * size + x];
  const shadow = blur(off, size, size, Math.round(size * 0.016));
  for (let i = 0; i < size * size; i++) {
    const k = 1 - 0.42 * shadow[i];
    const o = i * 4; out[o] *= k; out[o + 1] *= k; out[o + 2] *= k;
  }

  // Product.
  for (let y = Math.max(0, Y0); y < Math.min(size, Y1); y++) {
    for (let x = Math.max(0, X0); x < Math.min(size, X1); x++) {
      const a = placed[y * size + x];
      if (a <= 0) continue;
      const sx = box.x + (x + 0.5 - dx) / scale - 0.5, sy = box.y + (y + 0.5 - dy) / scale - 0.5;
      const o = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = out[o + c] * (1 - a) + sample(sx, sy, c) * a;
    }
  }
  return out;
}
