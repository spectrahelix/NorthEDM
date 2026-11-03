"use client";

// The report — on screen and in the PDF it is the same element, printed with
// the browser's own PDF engine, so the two cannot drift apart.

import type { Report } from "@/utils/numerology/report";
import { AstroChartWheel } from "./AstroChartWheel";

export function He({ children }: { children: React.ReactNode }) {
  return (
    <bdi dir="rtl" lang="he" className="font-hebrew">
      {children}
    </bdi>
  );
}

/** English text with Hebrew runs isolated, so "ט״ו instead of י״ה" keeps its order. */
export function Mixed({ text }: { text: string }) {
  const parts = text.split(/([֐-׿יִ-ﭏ]+(?:[ ־][֐-׿יִ-ﭏ]+)*)/g);
  return <>{parts.map((p, i) => (i % 2 ? <He key={i}>{p}</He> : p))}</>;
}

function Refs({ ids, order }: { ids: string[]; order: Map<string, number> }) {
  const nums = ids.map((id) => order.get(id)).filter((n): n is number => n != null);
  if (!nums.length) return null;
  return <span className="ml-1 text-xs text-neutral-500 print:text-neutral-500">[{nums.join(", ")}]</span>;
}

const th = "bg-[#17364d] px-3 py-2 text-left text-xs font-semibold text-white";
const td = "border-b border-white/10 px-3 py-2 align-top print:border-neutral-300";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid-page">
      <h2 className="mb-3 text-xl font-semibold text-violet-100 print:text-[#17364d]">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className={`w-full border-collapse text-sm print:min-w-0 ${head.length >= 4 ? "min-w-[560px]" : ""}`}>
        <thead>
          <tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AstroHebrewReport({
  report,
  onChooseMatch,
}: {
  report: Report;
  onChooseMatch?: (rowKey: string, strongs: string) => void;
}) {
  const order = new Map(report.sources.map((s, i) => [s.id, i + 1]));
  const b = report.birth;
  const when = [
    b.gregorianLabel,
    b.timeAccuracy === "unknown" ? "time unknown" : `${b.localTime}${b.timeAccuracy === "approximate" ? ` ± ${b.plusMinusMinutes} min` : ""} (${b.utcOffset})`,
    b.place,
  ].join(" • ");
  const astro = report.astrology;

  return (
    <article id="ne-report" className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-neutral-100 sm:p-8 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-[#1f2d3a]">
      <p className="font-dm-mono text-xs uppercase tracking-widest text-violet-300 print:text-[#1f7a6d]">NorthEDM • Hebrew Birth &amp; Name Chart</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl print:text-[#17364d]">{report.displayName}</h1>
      <p className="mt-1 text-sm text-neutral-400 print:text-neutral-600">{when}</p>

      <div className="mt-6 border-t border-white/10 pt-5 print:border-neutral-300">
        <h2 className="text-2xl font-semibold print:text-[#17364d]">
          {report.hebrewDate.label}
          {report.hebrewDate.status === "uncertain" && <span className="ml-2 text-base font-normal text-amber-300 print:text-amber-700">(not confirmed)</span>}
        </h2>
        <p className="mt-2 text-center text-2xl font-bold"><He>{report.hebrewDate.hebrew}</He></p>
        <p className="mt-2 text-neutral-300 print:text-neutral-800">
          {report.hebrewDate.note}
          <Refs ids={report.hebrewDate.sourceIds} order={order} />
        </p>
        {report.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-amber-200 print:text-amber-800">
            {report.warnings.map((w) => <li key={w}>• {w}</li>)}
          </ul>
        )}
      </div>

      <Section title="1. Name meanings, Hebrew spellings and numbers">
        <p className="mb-3 text-center text-xl font-bold"><He>{report.fullHebrewName}</He></p>
        <Table head={["Name", "Historical meaning / origin", "Hebrew", "Value / addends"]}>
          {report.nameChart.map((n) => (
            <tr key={n.componentId}>
              <td className={td}>{n.originalName}</td>
              <td className={td}><Mixed text={n.historicalMeaning} /><Refs ids={n.sourceIds} order={order} /></td>
              <td className={`${td} text-base`}><He>{n.hebrewSpelling}</He></td>
              <td className={td}>
                <strong>{n.value}</strong>
                <br />
                <span className="text-xs text-neutral-400 print:text-neutral-600">{n.letters.map((l) => l.value).join(" + ")}</span>
              </td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 font-semibold text-emerald-300 print:text-[#1f7a6d]">
          {report.totals.suffix
            ? `Base name: ${report.totals.base} • Suffix: ${report.totals.suffix} • Combined: ${report.totals.combined}`
            : `Full name: ${report.totals.base}`}
        </p>
        <p className="mt-1 text-xs text-neutral-500 print:text-neutral-600">
          Method: standard Hebrew gematria (final letters keep their ordinary value). Addends follow the Hebrew letters in reading order.
          A phonetic spelling is not a translation of a name&apos;s meaning.
        </p>
      </Section>

      <Section title="Birth timing and the Hebrew day">
        <Table head={["Timing / status", "Hebrew date", "Day number and association"]}>
          {report.timingChart.map((t) => (
            <tr key={t.condition}>
              <td className={td}>{t.condition}</td>
              <td className={td}>{t.hebrewDate}<br /><He>{t.hebrew}</He></td>
              <td className={td}>
                <strong>{t.value}</strong>
                {t.matchedHebrew && <> — <He>{t.matchedHebrew}</He> ({t.pronunciation})</>}
                <br />
                <Mixed text={t.meaning} />
                <Refs ids={t.sourceIds} order={order} />
              </td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-xs text-neutral-500 print:text-neutral-600">
          Local sunset {b.sunsetLocal ?? "not calculable"}
          {b.nightfallLocal ? `; nightfall ${b.nightfallLocal}` : ""}. {b.sunsetConvention}
        </p>
      </Section>

      <Section title="2. Number-to-association chart">
        <p className="mb-3 text-sm text-neutral-400 print:text-neutral-600">
          Matching words are independent numerical equivalents. They do not replace the name meanings in chart 1.
        </p>
        <Table head={["Number", "Comes from", "Matching word / meaning / association", "Basis / status"]}>
          {report.numberChart.map((n) => (
            <tr key={n.key}>
              <td className={`${td} font-semibold`}>{n.value}</td>
              <td className={td}>{n.originLabel}</td>
              <td className={td}>
                {n.matchedHebrew && <><He>{n.matchedHebrew}</He>{n.pronunciation ? ` (${n.pronunciation})` : ""}<br /></>}
                <Mixed text={n.meaningOrAssociation} />
                <Refs ids={n.sourceIds} order={order} />
                {onChooseMatch && n.options.length > 0 && (
                  <label className="mt-2 block text-xs text-neutral-400 print:hidden">
                    Show a different word ({n.totalMatches} share this value):
                    <select
                      className="mt-1 block w-full rounded-lg border border-white/15 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                      value={n.kind === "exact-word-value" ? n.options.find((o) => o.hebrew === n.matchedHebrew)?.strongs ?? "" : n.kind === "traditional-number-symbolism" ? "" : "none"}
                      onChange={(e) => onChooseMatch(n.key, e.target.value)}
                    >
                      {n.kind === "traditional-number-symbolism" && <option value="">Traditional association (default)</option>}
                      {n.options.map((o) => (
                        <option key={o.strongs} value={o.strongs}>
                          {o.hebrew} ({o.pronunciation}) — {o.meaning.slice(0, 50)}
                        </option>
                      ))}
                      <option value="none">No word, number only</option>
                    </select>
                  </label>
                )}
              </td>
              <td className={td}>{n.status}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-xs text-neutral-500 print:text-neutral-600">
          Equal values do not establish a connection, and a same-value word is not the meaning of a person&apos;s name.
        </p>
      </Section>

      <Section title="3. Traditional figures and concepts">
        <Table head={["Connection", "Figure / concept", "Tradition and explanation"]}>
          {report.contextChart.map((c, i) => (
            <tr key={i}>
              <td className={td}>{c.connection}</td>
              <td className={td}>{c.figureOrConcept}</td>
              <td className={td}><strong>{c.tradition}:</strong> <Mixed text={c.explanation} /><Refs ids={c.sourceIds} order={order} /></td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-xs text-neutral-500 print:text-neutral-600">
          A sourced association does not assign a guardian, hostile being, moral character or destiny.
        </p>
      </Section>

      <Section title="Western astrology">
        {astro.status === "unavailable" ? (
          <p className="text-neutral-300">Not included: {astro.reason}.</p>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
              <div className="text-neutral-200 print:text-[#17364d]"><AstroChartWheel astro={astro} /></div>
              <div>
                <Table head={["Body", "Position", "House"]}>
                  {astro.placements.map((p) => (
                    <tr key={p.body}>
                      <td className={td}>{p.body}{p.retrograde ? " Rx" : ""}</td>
                      <td className={td}>{p.label}</td>
                      <td className={td}>{p.house ?? "—"}</td>
                    </tr>
                  ))}
                  {astro.ascendant && <tr><td className={td}>Ascendant</td><td className={td}>{astro.ascendant.label}</td><td className={td}>1</td></tr>}
                  {astro.midheaven && <tr><td className={td}>Midheaven</td><td className={td}>{astro.midheaven.label}</td><td className={td}>—</td></tr>}
                </Table>
              </div>
            </div>
            {astro.aspects && astro.aspects.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 font-semibold">Aspects</h3>
                <Table head={["Between", "Aspect", "Orb"]}>
                  {astro.aspects.map((a) => (
                    <tr key={`${a.a}-${a.b}-${a.type}`}>
                      <td className={td}>{a.a} – {a.b}</td>
                      <td className={td}>{a.type} ({a.exact}°)</td>
                      <td className={td}>{a.orb.toFixed(2)}°</td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
            <p className="mt-3 text-xs text-neutral-500 print:text-neutral-600">
              {astro.settings.zodiac} zodiac • {astro.settings.houseSystem} houses • {astro.settings.frame} • {astro.settings.orbs} •{" "}
              {astro.instantUtc ? `Birth instant ${astro.instantUtc.replace("T", " ").slice(0, 16)} UTC` : astro.window ? `Window ${astro.window.fromUtc.slice(0, 16)}–${astro.window.toUtc.slice(11, 16)} UTC` : ""} •{" "}
              {b.lat.toFixed(4)}, {b.lon.toFixed(4)} • {astro.settings.provider}
              <Refs ids={["astronomyEngine"]} order={order} />
            </p>
          </>
        )}
      </Section>

      <Section title="Sources">
        <ol className="space-y-1 text-xs text-neutral-400 print:text-neutral-700">
          {report.sources.map((s, i) => (
            <li key={s.id}>
              [{i + 1}]{" "}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-violet-300 underline-offset-2 hover:underline print:text-[#1f7a6d]">
                  <Mixed text={s.label} />
                </a>
              ) : (
                <Mixed text={s.label} />
              )}{" "}
              ({s.site})
            </li>
          ))}
        </ol>
      </Section>

      <p className="mt-8 text-xs text-neutral-500 print:text-neutral-600">
        {report.note} Prepared {report.generatedAt.slice(0, 10)} by NorthEDM — Unite the Northeast. Report schema v{report.schemaVersion}, {report.method}.
      </p>
    </article>
  );
}
