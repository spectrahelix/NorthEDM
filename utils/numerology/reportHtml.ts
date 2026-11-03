// The PDF's HTML: a self-contained page (inline CSS, embedded fonts) with the
// same sections, tables and numbers as the on-screen report
// (app/apps-and-tools/astrology-hebrew-numerology/AstroHebrewReport.tsx).
// Every string from the report is escaped; Hebrew runs are isolated so they
// keep their reading order inside English sentences.

import type { Report } from "./report.ts";
import { wheelSvg } from "./wheelSvg.ts";
import { PDF_FONT_CSS } from "./data/pdfFonts.ts";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const HE_RUN = /[֐-׿יִ-ﭏ]+(?:[ ־][֐-׿יִ-ﭏ]+)*/g;
const txt = (s: unknown) => esc(s).replace(HE_RUN, (m) => `<bdi dir="rtl" lang="he" class="he">${m}</bdi>`);
const he = (s: unknown) => `<bdi dir="rtl" lang="he" class="he">${esc(s)}</bdi>`;

function table(head: string[], rows: string[], cls = ""): string {
  return `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

export function reportToHtml(r: Report): string {
  const order = new Map(r.sources.map((s, i) => [s.id, i + 1]));
  const refs = (ids: string[]) => {
    const n = ids.map((id) => order.get(id)).filter((x): x is number => x != null);
    return n.length ? ` <span class="ref">[${n.join(", ")}]</span>` : "";
  };
  const b = r.birth;
  const when = [
    b.gregorianLabel,
    b.timeAccuracy === "unknown" ? "time unknown" : `${b.localTime}${b.timeAccuracy === "approximate" ? ` ± ${b.plusMinusMinutes} min` : ""} (${b.utcOffset})`,
    b.place,
  ].join(" • ");
  const a = r.astrology;

  const nameRows = r.nameChart.map((n) =>
    `<tr><td>${esc(n.originalName)}</td><td>${txt(n.historicalMeaning)}${refs(n.sourceIds)}</td><td class="hebcell">${he(n.hebrewSpelling)}</td><td><b>${n.value}</b><br><span class="small">${n.letters.map((l) => l.value).join(" + ")}</span></td></tr>`);
  const timingRows = r.timingChart.map((t) =>
    `<tr><td>${esc(t.condition)}</td><td>${esc(t.hebrewDate)}<br>${he(t.hebrew)}</td><td><b>${t.value}</b>${t.matchedHebrew ? ` — ${he(t.matchedHebrew)} (${esc(t.pronunciation)})` : ""}<br>${txt(t.meaning)}${refs(t.sourceIds)}</td></tr>`);
  const numberRows = r.numberChart.map((n) =>
    `<tr><td><b>${n.value}</b></td><td>${esc(n.originLabel)}</td><td>${n.matchedHebrew ? `${he(n.matchedHebrew)}${n.pronunciation ? ` (${esc(n.pronunciation)})` : ""}<br>` : ""}${txt(n.meaningOrAssociation)}${refs(n.sourceIds)}</td><td>${esc(n.status)}</td></tr>`);
  const contextRows = r.contextChart.map((c) =>
    `<tr><td>${esc(c.connection)}</td><td>${esc(c.figureOrConcept)}</td><td><b>${esc(c.tradition)}:</b> ${txt(c.explanation)}${refs(c.sourceIds)}</td></tr>`);

  let astro = "";
  if (a.status === "unavailable") {
    astro = `<p>Not included: ${esc(a.reason)}.</p>`;
  } else {
    const rows = a.placements.map((p) => `<tr><td>${esc(p.body)}${p.retrograde ? " Rx" : ""}</td><td>${esc(p.label)}</td><td>${p.house ?? "—"}</td></tr>`);
    if (a.ascendant) rows.push(`<tr><td>Ascendant</td><td>${esc(a.ascendant.label)}</td><td>1</td></tr>`);
    if (a.midheaven) rows.push(`<tr><td>Midheaven</td><td>${esc(a.midheaven.label)}</td><td>—</td></tr>`);
    const aspects = a.aspects && a.aspects.length
      ? `<h3>Aspects</h3>${table(["Between", "Aspect", "Orb"], a.aspects.map((x) => `<tr><td>${esc(x.a)} – ${esc(x.b)}</td><td>${esc(x.type)} (${x.exact}°)</td><td>${x.orb.toFixed(2)}°</td></tr>`))}`
      : "";
    const instant = a.instantUtc ? `Birth instant ${a.instantUtc.replace("T", " ").slice(0, 16)} UTC` : a.window ? `Window ${a.window.fromUtc.slice(0, 16)}–${a.window.toUtc.slice(11, 16)} UTC` : "";
    astro = `<div class="astro"><div class="wheel">${wheelSvg(a, { color: "#17364d", accent: "#6d28d9", font: '"NE Symbols", "NE Sans", sans-serif' })}</div><div>${table(["Body", "Position", "House"], rows)}</div></div>
${aspects}
<p class="note">${esc(a.settings.zodiac)} zodiac • ${esc(a.settings.houseSystem)} houses • ${esc(a.settings.frame)} • ${esc(a.settings.orbs)} • ${esc(instant)} • ${b.lat.toFixed(4)}, ${b.lon.toFixed(4)} • ${esc(a.settings.provider)} • Rx = retrograde${refs(["astronomyEngine"])}</p>`;
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(r.displayName)} — Hebrew Birth Chart</title>
<style>
${PDF_FONT_CSS}
@page { size: Letter; margin: 0.6in 0.6in 0.75in; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "NE Sans", "NE Hebrew", "NE Symbols", sans-serif; color: #1f2d3a; font-size: 10pt; line-height: 1.45; }
.he { font-family: "NE Hebrew", "NE Sans", sans-serif; unicode-bidi: isolate; }
.kicker { color: #1f7a6d; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; }
h1 { font-size: 22pt; margin: 4px 0 2px; color: #17364d; }
h2 { font-size: 13pt; color: #17364d; margin: 18px 0 6px; break-after: avoid; }
h3 { font-size: 11pt; color: #17364d; margin: 12px 0 4px; }
.sub { color: #5b6b78; }
.date { border-top: 1px solid #d5dde3; margin-top: 12px; padding-top: 10px; }
.center { text-align: center; font-size: 16pt; font-weight: 700; margin: 6px 0; }
.uncertain { color: #b45309; font-size: 11pt; font-weight: 400; }
table { width: 100%; border-collapse: collapse; margin: 4px 0; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #17364d; color: #fff; text-align: left; padding: 6px 8px; font-size: 8.5pt; }
td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #d5dde3; overflow-wrap: break-word; }
.hebcell { font-size: 12pt; }
.small, .ref, .note { color: #5b6b78; font-size: 8pt; }
.total { color: #1f7a6d; font-weight: 700; margin-top: 6px; }
.warn { color: #92400e; font-size: 9pt; }
.astro { display: grid; grid-template-columns: 300px 1fr; gap: 16px; align-items: start; break-inside: avoid; }
.wheel { color: #17364d; }
ol.src { list-style: none; padding: 0; font-size: 8pt; }
a { color: #1f7a6d; text-decoration: none; }
</style></head><body>
<div class="kicker">NorthEDM • Hebrew Birth &amp; Name Chart</div>
<h1>${esc(r.displayName)}</h1>
<div class="sub">${esc(when)}</div>
<div class="date">
<h2>${esc(r.hebrewDate.label)}${r.hebrewDate.status === "uncertain" ? ` <span class="uncertain">(not confirmed)</span>` : ""}</h2>
<div class="center">${he(r.hebrewDate.hebrew)}</div>
<p>${txt(r.hebrewDate.note)}${refs(r.hebrewDate.sourceIds)}</p>
${r.warnings.length ? `<ul class="warn">${r.warnings.map((w) => `<li>${txt(w)}</li>`).join("")}</ul>` : ""}
</div>

<h2>1. Name meanings, Hebrew spellings and numbers</h2>
<div class="center">${he(r.fullHebrewName)}</div>
${table(["Name", "Historical meaning / origin", "Hebrew", "Value / addends"], nameRows)}
<div class="total">${r.totals.suffix ? `Base name: ${r.totals.base} • Suffix: ${r.totals.suffix} • Combined: ${r.totals.combined}` : `Full name: ${r.totals.base}`}</div>
<p class="note">Method: standard Hebrew gematria (final letters keep their ordinary value). Addends follow the Hebrew letters in reading order. A phonetic spelling is not a translation of a name's meaning.</p>

<h2>Birth timing and the Hebrew day</h2>
${table(["Timing / status", "Hebrew date", "Day number and association"], timingRows)}
<p class="note">Local sunset ${esc(b.sunsetLocal ?? "not calculable")}${b.nightfallLocal ? `; nightfall ${esc(b.nightfallLocal)}` : ""}. ${esc(b.sunsetConvention)}</p>

<h2>2. Number-to-association chart</h2>
<p class="note">Matching words are independent numerical equivalents. They do not replace the name meanings in chart 1.</p>
${table(["Number", "Comes from", "Matching word / meaning / association", "Basis / status"], numberRows)}
<p class="note">Equal values do not establish a connection, and a same-value word is not the meaning of a person's name.</p>

<h2>3. Traditional figures and concepts</h2>
${table(["Connection", "Figure / concept", "Tradition and explanation"], contextRows)}
<p class="note">A sourced association does not assign a guardian, hostile being, moral character or destiny.</p>

<h2>Western astrology</h2>
${astro}

<h2>Sources</h2>
<ol class="src">${r.sources.map((s, i) => `<li>[${i + 1}] ${s.url ? `<a href="${esc(s.url)}">${txt(s.label)}</a>` : txt(s.label)} (${esc(s.site)})</li>`).join("")}</ol>
<p class="note">${esc(r.note)} Prepared ${esc(r.generatedAt.slice(0, 10))} by NorthEDM — Unite the Northeast. Report schema v${r.schemaVersion}, ${esc(r.method)}.</p>
</body></html>`;
}

export function pdfFilename(name: string): string {
  return `NorthEDM_${name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "Report"}_Astrology_Hebrew_Numerology.pdf`;
}
