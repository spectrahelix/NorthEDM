#!/usr/bin/env node
// Is the site wired to itself correctly?
//
//   node scripts/check-wiring.mjs
//
// Every bug that has cost this site real money shared one shape: an edit landed
// in code that wasn't the live path, and nothing said so.
//
//   • /promote POSTed to /api/promote, which did not exist. A missing App
//     Router route returns 200 with the HTML shell rather than a 404, so
//     res.json() threw, the button hung forever, and every promoter
//     application was discarded for months.
//   • Two copies of WeatherStrip, byte-identical, so a fix to one left the
//     other broken.
//   • /crowdwave/forum was a stale copy of /forum with no content moderation.
//   • profiles and user_profiles both existed; ~20 code paths read the one that
//     was almost always empty.
//
// None of those are type errors, so tsc and the build stay green. This script
// is the check that catches them. It reads files only — no network, no
// database, safe to run any time.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename, relative } from "node:path";

const ROOT = process.cwd();
let problems = 0;
const note = (msg) => { problems++; console.log(msg); };

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".git")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(join(ROOT, "app")).concat(
  statSync(join(ROOT, "utils")).isDirectory() ? walk(join(ROOT, "utils")) : []
);
const code = files.filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f) => readFileSync(f, "utf8");
const rel = (f) => relative(ROOT, f);

// ── 1. Does every fetch("/api/…") reach a route that exists? ────────────────
const routes = code
  .filter((f) => basename(f) === "route.ts" && f.includes(`${join("app", "api")}`))
  .map((f) => rel(f).replace(/^app/, "").replace(/\/route\.ts$/, ""));

const routeMatchers = routes.map((r) => ({
  route: r,
  re: new RegExp("^" + r.replace(/\[\.\.\.\w+\]/g, ".+").replace(/\[\w+\]/g, "[^/]+") + "$"),
}));

console.log("1. fetch() targets → API routes");
let apiChecked = 0;
for (const f of code) {
  const txt = read(f);
  for (const m of txt.matchAll(/fetch\(\s*[`"']([^`"']*)/g)) {
    let target = m[1];
    if (!target.includes("/api/")) continue;
    target = target.split("?")[0].replace(/\/$/, "");
    // Template interpolation can appear ANYWHERE, including mid-path
    // (`/api/quote/${token}/pay`). Replace each ${...} with a single-segment
    // wildcard rather than truncating — truncating reported a false failure on
    // exactly that call, and a checker that cries wolf gets ignored.
    const wildcard = "\u0000SEG\u0000";
    target = target.replace(/\$\{[^}]*\}/g, wildcard);
    apiChecked++;
    const probe = target.split(wildcard).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+");
    const probeRe = new RegExp("^" + probe + "$");
    // A match in either direction: our wildcard against a concrete route, or a
    // route's own [param] against our concrete path.
    const ok = routes.some((r) => probeRe.test(r)) ||
      routeMatchers.some((rm) => rm.re.test(target.replaceAll(wildcard, "x")));
    if (!ok) {
      note(`   ✗ ${rel(f)}\n       fetches ${target.replaceAll(wildcard, "${…}")} — no such route`);
    }
  }
}
console.log(`   checked ${apiChecked} call sites against ${routes.length} routes`);

// ── 2. Two files with the same component name ──────────────────────────────
// Not always wrong, but it is how an edit lands in the copy nobody renders.
console.log("\n2. duplicate component names");
const FRAMEWORK = new Set([
  "page.tsx", "layout.tsx", "route.ts", "loading.tsx", "error.tsx",
  "not-found.tsx", "template.tsx", "default.tsx", "client.tsx",
  "opengraph-image.tsx", "twitter-image.tsx", "icon.tsx", "sitemap.ts", "robots.ts",
]);
const byName = new Map();
for (const f of code) {
  const b = basename(f);
  if (FRAMEWORK.has(b)) continue;
  byName.set(b, [...(byName.get(b) ?? []), f]);
}
let dupes = 0;
for (const [name, list] of byName) {
  if (list.length < 2) continue;
  dupes++;
  const identical = list.every((f) => read(f) === read(list[0]));
  note(
    `   ✗ ${name} exists ${list.length}× (${identical ? "IDENTICAL — fix one, the other stays broken" : "DIVERGENT — they have drifted apart"})\n` +
      list.map((f) => `       ${rel(f)}`).join("\n")
  );
}
if (!dupes) console.log("   none");

// ── 3. Tables the code reads that the schema no longer has ─────────────────
// Catches a dropped or renamed table still referenced somewhere. The list is
// maintained by hand because the schema lives in Supabase, not in this repo.
console.log("\n3. references to retired tables");
const RETIRED = ["profiles"]; // dropped 2026-09-21, folded into user_profiles
let retiredHits = 0;
for (const f of code) {
  const txt = read(f);
  for (const t of RETIRED) {
    // from("profiles") but NOT from("user_profiles")
    const re = new RegExp(`from\\(\\s*["'\`]${t}["'\`]`, "g");
    for (const m of txt.matchAll(re)) {
      const before = txt.slice(Math.max(0, m.index - 6), m.index + 8);
      if (before.includes("user_")) continue;
      retiredHits++;
      note(`   ✗ ${rel(f)} still reads the retired table "${t}"`);
    }
  }
}
if (!retiredHits) console.log("   none");

console.log(
  problems === 0
    ? "\n✅ wiring looks consistent"
    : `\n❌ ${problems} problem${problems === 1 ? "" : "s"} — each one is a place an edit could land in code that never runs`
);
process.exit(problems === 0 ? 0 : 1);
