#!/usr/bin/env node
// Render a Hebrew Birth & Name Chart PDF from a report JSON.
//   node render-chart.mjs <report.json> [out.pdf]
// Refuses to render if any number disagrees with recomputed gematria, if a
// numeric total has no Chart 2 row, or if a cited source id is missing.
// Writes <out>.html next to the PDF so the preview and the PDF are one file.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { calculateGematria } from "./gematria.mjs";

const [, , inPath, outArg] = process.argv;
if (!inPath) { console.error("usage: render-chart.mjs <report.json> [out.pdf]"); process.exit(2); }
const r = JSON.parse(readFileSync(inPath, "utf8"));

// ---------- verification (must be able to fail) ----------
const problems = [];
const sourceIds = new Set((r.sources ?? []).map((s) => s.id));
const cite = (ids, where) => ids?.forEach((id) => sourceIds.has(id) || problems.push(`${where}: unknown source [${id}]`));

let base = 0, suffix = 0;
for (const row of r.nameChart ?? []) {
  const g = calculateGematria(row.hebrewSpelling);
  if (g.total !== row.value) problems.push(`Chart 1 ${row.originalName}: ${row.hebrewSpelling} = ${g.total}, row says ${row.value}`);
  row._letters = g.letters;
  if (row.role === "suffix") suffix += g.total; else base += g.total;
  cite(row.sourceIds, `Chart 1 ${row.originalName}`);
}
const combined = base + suffix;
for (const row of r.numberChart ?? []) {
  if (row.matchedHebrew && row.kind !== "calendar-label") {
    const v = calculateGematria(row.matchedHebrew).total;
    if (v !== row.value) problems.push(`Chart 2 ${row.value}: ${row.matchedHebrew} actually = ${v}`);
  }
  if (!row.matchedHebrew && !/No additional|not verified|No extra/i.test(`${row.meaningOrAssociation} ${row.status}`) && row.kind !== "calendar-label")
    problems.push(`Chart 2 ${row.value}: no matched word and no explicit "not verified" status`);
  cite(row.sourceIds, `Chart 2 ${row.value}`);
}
for (const row of r.timingChart ?? []) {
  if (row.matchedHebrew && calculateGematria(row.matchedHebrew).total !== row.value)
    problems.push(`Timing ${row.hebrewDate}: ${row.matchedHebrew} ≠ ${row.value}`);
  cite(row.sourceIds, `Timing ${row.hebrewDate}`);
}
for (const row of r.contextChart ?? []) cite(row.sourceIds, `Chart 3 ${row.connection}`);
cite(r.hebrewDate?.sourceIds, "Hebrew date");

// Spec §10: Chart 2 covers every component, base, suffix, combined and birth day.
const needed = new Set([...(r.nameChart ?? []).map((n) => n.value), base]);
if (suffix) needed.add(combined);
const day = (r.timingChart ?? []).find((t) => t.confirmed)?.value;
if (day) needed.add(day);
const have = new Set((r.numberChart ?? []).map((n) => n.value));
for (const n of needed) if (!have.has(n)) problems.push(`Chart 2 is missing a row for ${n}`);

if (problems.length) {
  console.error("Refusing to render:\n - " + problems.join("\n - "));
  process.exit(1);
}

// ---------- HTML ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const he = (s) => `<bdi dir="rtl" lang="he" class="he">${esc(s)}</bdi>`;
const refs = (ids) => (ids?.length ? ` <span class="ref">[${ids.join(", ")}]</span>` : "");
const when = [r.birth?.gregorian && new Date(r.birth.gregorian + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }), r.birth?.localTime, r.birth?.place].filter(Boolean).join(" • ");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(r.displayName)} — Hebrew Birth Chart</title>
<style>
  @page { size: Letter; margin: 0.75in 0.75in 0.8in; }
  body { font-family: "DejaVu Sans", "FreeSans", sans-serif; color: #1f2d3a; font-size: 10.5pt; line-height: 1.45; }
  .he { font-family: "DejaVu Sans", "FreeSerif", sans-serif; unicode-bidi: isolate; }
  .kicker { color: #1f7a6d; font-weight: 700; font-size: 8.5pt; letter-spacing: .04em; text-transform: uppercase; }
  h1 { font-size: 24pt; margin: 4px 0; color: #17364d; } h2 { color: #17364d; margin: 18px 0 6px; }
  .sub { color: #5b6b78; } hr { border: 0; border-top: 1px solid #d5dde3; margin: 12px 0; }
  .center-he { text-align: center; font-size: 15pt; font-weight: 700; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 4px; page-break-inside: auto; }
  thead { display: table-header-group; } tr { page-break-inside: avoid; }
  th { background: #17364d; color: #fff; text-align: left; padding: 7px 9px; font-size: 9pt; }
  td { padding: 7px 9px; vertical-align: top; border-bottom: 1px solid #d5dde3; overflow-wrap: break-word; hyphens: manual; }
  tbody tr:nth-child(odd) td { background: #eef3f5; }
  .tot { color: #1f7a6d; font-weight: 700; margin-top: 8px; }
  .note { color: #5b6b78; font-size: 8.5pt; } .ref { color: #5b6b78; font-size: 8.5pt; }
  .pb { page-break-before: always; } section { break-inside: avoid; } h2 { break-after: avoid; } ol.src { font-size: 8.5pt; padding-left: 0; list-style: none; }
  a { color: #1f7a6d; text-decoration: none; }
</style></head><body>
<div class="kicker">Hebrew Birth &amp; Name Chart</div>
<h1>${esc(r.displayName)}</h1>
<div class="sub">${esc(when)}</div><hr>
${r.hebrewDate ? `<h2>${esc(r.hebrewDate.label)}</h2><div class="center-he">${he(r.hebrewDate.hebrew)}</div><p>${esc(r.hebrewDate.note)}${refs(r.hebrewDate.sourceIds)}</p>` : ""}

<h2>1. Name meanings, Hebrew spellings and numbers</h2>
${r.fullHebrewName ? `<div class="center-he">${he(r.fullHebrewName)}</div>` : ""}
<table><thead><tr><th>Name</th><th>Historical meaning / origin</th><th>Hebrew</th><th>Value / addends</th></tr></thead><tbody>
${r.nameChart.map((n) => `<tr><td>${esc(n.originalName)}</td><td>${esc(n.historicalMeaning)}${n.familyOrigin ? ` <em>(${esc(n.familyOrigin)})</em>` : ""}${refs(n.sourceIds)}</td><td>${he(n.hebrewSpelling)}</td><td><strong>${n.value}</strong><br>${n._letters.map((l) => l.value).join(" + ")}</td></tr>`).join("")}
</tbody></table>
<div class="tot">Base name: ${base}${suffix ? ` • Suffix: ${suffix} • Combined: ${combined}` : ""}</div>
<p class="note">Method: standard Hebrew gematria (final letters keep their ordinary value). Addends follow the Hebrew letters in reading order. Historical meanings and phonetic spellings are different kinds of information.</p>

${r.timingChart?.length ? `<section><h2>Birth timing and the Hebrew day</h2>
<table><thead><tr><th>Timing / status</th><th>Hebrew date</th><th>Number-to-word association</th></tr></thead><tbody>
${r.timingChart.map((t) => `<tr><td>${esc(t.condition)}</td><td>${esc(t.hebrewDate)}<br>${he(t.hebrew)}</td><td>${t.matchedHebrew ? `${he(t.matchedHebrew)} (${esc(t.pronunciation)}), ${esc(t.meaning)}. ` : ""}${t.value}${refs(t.sourceIds)}</td></tr>`).join("")}
</tbody></table></section>` : ""}

<h2 class="pb">2. Number-to-association chart</h2>
<p class="note">The matching words below are independent numerical equivalents. They do not replace the name meanings in Chart 1.</p>
<table><thead><tr><th>Number</th><th>Comes from</th><th>Matching word / meaning / association</th><th>Basis / status</th></tr></thead><tbody>
${r.numberChart.map((n) => `<tr><td><strong>${n.value}</strong></td><td>${esc(n.originLabel)}</td><td>${n.matchedHebrew && n.kind !== "calendar-label" ? `${he(n.matchedHebrew)} (${esc(n.pronunciation)})<br>` : ""}${esc(n.meaningOrAssociation)}${refs(n.sourceIds)}</td><td>${esc(n.status)}</td></tr>`).join("")}
</tbody></table>
<p class="note">Equal values do not establish a unique connection, and a same-value word is not the meaning of a person's name.</p>

${r.contextChart?.length ? `<section><h2>3. Traditional figures and concepts</h2>
<table><thead><tr><th>Connection</th><th>Figure / concept</th><th>Tradition and explanation</th></tr></thead><tbody>
${r.contextChart.map((c) => `<tr><td>${esc(c.connection)}</td><td>${esc(c.figureOrConcept)}</td><td><strong>${esc(c.tradition)}:</strong> ${esc(c.explanation)}${refs(c.sourceIds)}</td></tr>`).join("")}
</tbody></table>
<p class="note">A sourced association does not assign a personal guardian, hostile being, moral character, or destiny.</p></section>` : ""}

<h2>Western astrology</h2>
<p>${r.astrology?.status === "available" ? "See attached positions." : `Not included: ${esc((r.astrology?.reason ?? "no ephemeris provider configured").replace(/\.$/, ""))}. No placements are estimated.`}</p>

<h2>Sources for these charts</h2>
<ol class="src">${r.sources.map((s) => `<li>[${esc(s.id)}] ${s.url ? `<a href="${esc(s.url)}">${esc(s.label)}</a>` : esc(s.label)} (${esc(s.site)})</li>`).join("")}</ol>
<p class="note">Astrology and numerology are interpretive traditions for reflection, not scientifically validated predictions. Prepared ${new Date().toISOString().slice(0, 10)} by NorthEDM — Unite the Northeast.</p>
</body></html>`;

const safe = (r.displayName || "Report").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
const outPdf = outArg || `NorthEDM_${safe}_Astrology_Hebrew_Numerology.pdf`;
const outHtml = outPdf.replace(/\.pdf$/i, "") + ".html";
writeFileSync(outHtml, html);

// Playwright is pre-installed globally in cloud sessions; fall back to the project copy.
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = await import("playwright")); }
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: outPdf, format: "Letter", printBackground: true, displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="font-size:8px;color:#5b6b78;width:100%;padding:0 0.75in;display:flex;justify-content:space-between"><span>Hebrew Birth &amp; Name Chart • Cultural and symbolic interpretation</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: "0.75in", bottom: "0.8in", left: "0.75in", right: "0.75in" },
});
await browser.close();
console.log(`verified: base ${base}, suffix ${suffix}, combined ${combined}\nwrote ${outPdf}\nwrote ${outHtml}`);
