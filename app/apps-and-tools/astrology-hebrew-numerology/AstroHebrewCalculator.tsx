"use client";

import { useMemo, useState } from "react";
import { calculateGematria } from "@/utils/numerology/gematria";
import { suggestHebrewSpellings } from "@/utils/numerology/transliterate";
import type { Report, BirthChartInput, ComponentRole } from "@/utils/numerology/report";
import { useUnsavedDraft } from "@/utils/useUnsavedDraft";
import { AstroHebrewReport, He, Mixed } from "./AstroHebrewReport";

const API = "/api/apps-tools/astrology-hebrew";

type Place = { label: string; lat: number; lon: number; zone: string };
type NamePart = { role: ComponentRole; original: string; hebrew: string; meaning: string; meaningSourceUrl: string; edited: boolean };

// Generational suffixes are TRANSLATED (V = "the fifth"), not spelled by sound.
const SUFFIXES: Array<{ label: string; hebrew: string }> = [
  { label: "II (the second)", hebrew: "השני" },
  { label: "III (the third)", hebrew: "השלישי" },
  { label: "IV (the fourth)", hebrew: "הרביעי" },
  { label: "V (the fifth)", hebrew: "החמישי" },
  { label: "VI (the sixth)", hebrew: "השישי" },
  { label: "VII (the seventh)", hebrew: "השביעי" },
  { label: "VIII (the eighth)", hebrew: "השמיני" },
  { label: "IX (the ninth)", hebrew: "התשיעי" },
  { label: "X (the tenth)", hebrew: "העשירי" },
];

const ROLES: Array<{ v: ComponentRole; label: string }> = [
  { v: "given", label: "First" },
  { v: "middle", label: "Middle" },
  { v: "surname", label: "Surname" },
  { v: "suffix", label: "Suffix" },
];

const inputCls = "w-full rounded-xl border border-white/15 bg-neutral-950/60 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:border-violet-300/60 focus:outline-none";
const btn = "rounded-xl px-4 py-2 font-semibold transition disabled:opacity-50";
const btnMain = `${btn} bg-violet-300 text-black hover:bg-violet-200`;
const btnGhost = `${btn} border border-white/15 text-neutral-200 hover:border-white/40`;

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch(`${API}/calculate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: "Unexpected response." }));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

function liveValue(hebrew: string): { total: number | null; error: string | null } {
  if (!hebrew.trim()) return { total: null, error: null };
  try {
    return { total: calculateGematria(hebrew).total, error: null };
  } catch (e) {
    return { total: null, error: (e as Error).message };
  }
}

function printReport(name: string) {
  const prev = document.title;
  document.title = `NorthEDM_${name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "Report"}_Astrology_Hebrew_Numerology`;
  const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
}

// ======================================================================
// Birth chart
// ======================================================================

type ChartDraft = {
  displayName: string;
  parts: NamePart[];
  date: string;
  time: string;
  accuracy: BirthChartInput["timeAccuracy"];
  plusMinus: number;
  foldChoice: "" | "earlier" | "later";
  placeQuery: string;
  place: Place | null;
};

const EMPTY: ChartDraft = {
  displayName: "",
  parts: [
    { role: "given", original: "", hebrew: "", meaning: "", meaningSourceUrl: "", edited: false },
    { role: "middle", original: "", hebrew: "", meaning: "", meaningSourceUrl: "", edited: false },
    { role: "surname", original: "", hebrew: "", meaning: "", meaningSourceUrl: "", edited: false },
  ],
  date: "",
  time: "",
  accuracy: "exact",
  plusMinus: 30,
  foldChoice: "",
  placeQuery: "",
  place: null,
};

function BirthChart() {
  const [d, setD] = useState<ChartDraft>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const restored = useUnsavedDraft<ChartDraft>("ne-astro-hebrew-draft", d, dirty, (saved) => setD(saved));

  const update = (patch: Partial<ChartDraft>) => { setD((x) => ({ ...x, ...patch })); setDirty(true); };
  const updatePart = (i: number, patch: Partial<NamePart>) => {
    setD((x) => ({ ...x, parts: x.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
    setDirty(true);
  };

  async function searchPlace() {
    if (d.placeQuery.trim().length < 2) return;
    setPlaceBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/resolve-place?q=${encodeURIComponent(d.placeQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Place search failed.");
      setPlaces(data.results);
      if (!data.results.length) setError("No place found. Try the town with its state or country.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlaceBusy(false);
    }
  }

  function buildInput(choices: Record<string, string>): BirthChartInput {
    return {
      displayName: d.displayName,
      components: d.parts.map((p) => ({ role: p.role, original: p.original, hebrew: p.hebrew, meaning: p.meaning, meaningSourceUrl: p.meaningSourceUrl })),
      date: d.date,
      time: d.accuracy === "unknown" ? null : d.time,
      timeAccuracy: d.accuracy,
      plusMinusMinutes: d.plusMinus,
      foldChoice: d.foldChoice || undefined,
      place: d.place as Place,
      chosenMatches: choices,
    };
  }

  async function calculate(choices = chosen) {
    setError("");
    if (!d.place) { setError("Search for the birthplace and choose it from the list."); return; }
    setBusy(true);
    try {
      const { report } = await post<{ report: Report }>({ mode: "chart", input: buildInput(choices) });
      setReport(report);
      setDirty(false); // calculated: the local draft is cleared
      requestAnimationFrame(() => document.getElementById("ne-report")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function chooseMatch(key: string, strongs: string) {
    const next = { ...chosen };
    if (strongs === "") delete next[key];
    else next[key] = strongs;
    setChosen(next);
    calculate(next);
  }

  return (
    <div>
      <form
        className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 print:hidden"
        onSubmit={(e) => { e.preventDefault(); setChosen({}); calculate({}); }}
      >
        {restored && <p className="rounded-xl bg-violet-300/10 px-3 py-2 text-sm text-violet-100">Your unfinished entries were restored.</p>}

        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold">Name</legend>
          <p className="text-sm text-neutral-400">
            Type each name, then check its Hebrew spelling. The suggestion follows the sound; edit it to match how the name is said.
          </p>
          {d.parts.map((p, i) => {
            const v = liveValue(p.hebrew);
            const suggestions = p.role === "suffix" ? [] : suggestHebrewSpellings(p.original);
            return (
              <div key={i} className="rounded-2xl border border-white/10 p-3">
                <div className="grid gap-2 sm:grid-cols-[110px_1fr_1fr_70px]">
                  <select
                    aria-label="Name part"
                    className={inputCls}
                    value={p.role}
                    onChange={(e) => updatePart(i, { role: e.target.value as ComponentRole, hebrew: "", edited: false })}
                  >
                    {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                  </select>
                  {p.role === "suffix" ? (
                    <select
                      aria-label="Suffix"
                      className={inputCls}
                      value={p.hebrew}
                      onChange={(e) => {
                        const s = SUFFIXES.find((x) => x.hebrew === e.target.value);
                        updatePart(i, { hebrew: e.target.value, original: s ? s.label.split(" ")[0] : "" });
                      }}
                    >
                      <option value="">Choose…</option>
                      {SUFFIXES.map((s) => <option key={s.hebrew} value={s.hebrew}>{s.label}</option>)}
                    </select>
                  ) : (
                    <input
                      aria-label="Name in English"
                      className={inputCls}
                      placeholder="Name in English"
                      value={p.original}
                      maxLength={40}
                      onChange={(e) => {
                        const original = e.target.value;
                        const auto = suggestHebrewSpellings(original)[0]?.hebrew ?? "";
                        updatePart(i, p.edited ? { original } : { original, hebrew: auto });
                      }}
                    />
                  )}
                  <input
                    aria-label="Hebrew spelling"
                    dir="rtl"
                    lang="he"
                    className={`${inputCls} font-hebrew text-lg`}
                    placeholder="Hebrew spelling"
                    value={p.hebrew}
                    maxLength={40}
                    readOnly={p.role === "suffix"}
                    onChange={(e) => updatePart(i, { hebrew: e.target.value, edited: true })}
                  />
                  <div className="flex items-center justify-end text-lg font-semibold text-emerald-300" aria-live="polite">
                    {v.total ?? ""}
                  </div>
                </div>
                {v.error && <p className="mt-1 text-sm text-amber-300">{v.error}</p>}
                {suggestions.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {suggestions.map((s) => (
                      <button
                        type="button"
                        key={s.hebrew}
                        onClick={() => updatePart(i, { hebrew: s.hebrew, edited: true })}
                        className={`rounded-full border px-3 py-1 ${p.hebrew === s.hebrew ? "border-violet-300 bg-violet-300/15" : "border-white/15 hover:border-white/40"}`}
                        title={s.note}
                      >
                        <He>{s.hebrew}</He> <span className="text-neutral-400">{liveValue(s.hebrew).total}{s.note ? ` · ${s.note}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
                {p.role !== "suffix" && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-neutral-400">Add the name&apos;s meaning (optional)</summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input className={inputCls} placeholder="Historical meaning, e.g. defender of men" value={p.meaning} maxLength={300} onChange={(e) => updatePart(i, { meaning: e.target.value })} />
                      <input className={inputCls} placeholder="Source link (https://…)" value={p.meaningSourceUrl} maxLength={300} onChange={(e) => updatePart(i, { meaningSourceUrl: e.target.value })} />
                    </div>
                  </details>
                )}
                {d.parts.length > 1 && (
                  <button type="button" className="mt-2 text-xs text-neutral-500 hover:text-red-300" onClick={() => update({ parts: d.parts.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => update({ parts: [...d.parts, { role: "middle", original: "", hebrew: "", meaning: "", meaningSourceUrl: "", edited: false }] })}>
              + Add a name
            </button>
            <button type="button" className={btnGhost} onClick={() => update({ parts: [...d.parts, { role: "suffix", original: "", hebrew: "", meaning: "", meaningSourceUrl: "", edited: false }] })}>
              + Add a suffix (II, III, V…)
            </button>
          </div>
          <input className={inputCls} placeholder="Name to show on the report (optional)" value={d.displayName} maxLength={80} onChange={(e) => update({ displayName: e.target.value })} />
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">Birth</legend>
          <label className="block text-sm">
            Date
            <input type="date" required className={`${inputCls} mt-1`} value={d.date} min="1800-01-01" max="2200-12-31" onChange={(e) => update({ date: e.target.value })} />
          </label>
          <label className="block text-sm">
            Time
            <select className={`${inputCls} mt-1`} value={d.accuracy} onChange={(e) => update({ accuracy: e.target.value as ChartDraft["accuracy"] })}>
              <option value="exact">Exact time</option>
              <option value="approximate">Approximate time</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          {d.accuracy !== "unknown" && (
            <label className="block text-sm">
              Local clock time at birth
              <input type="time" required className={`${inputCls} mt-1`} value={d.time} onChange={(e) => update({ time: e.target.value })} />
            </label>
          )}
          {d.accuracy === "approximate" && (
            <label className="block text-sm">
              Give or take (minutes)
              <input type="number" min={1} max={720} className={`${inputCls} mt-1`} value={d.plusMinus} onChange={(e) => update({ plusMinus: Number(e.target.value) })} />
            </label>
          )}
          {d.accuracy !== "unknown" && (
            <label className="block text-sm sm:col-span-2">
              <span className="text-neutral-400">Only if the clocks went back that night (the hour happened twice):</span>
              <select className={`${inputCls} mt-1`} value={d.foldChoice} onChange={(e) => update({ foldChoice: e.target.value as ChartDraft["foldChoice"] })}>
                <option value="">Not sure / not applicable</option>
                <option value="earlier">The first time (daylight time)</option>
                <option value="later">The second time (standard time)</option>
              </select>
            </label>
          )}
          <div className="sm:col-span-2">
            <label className="block text-sm" htmlFor="ne-place">Birthplace</label>
            <div className="mt-1 flex gap-2">
              <input
                id="ne-place"
                className={inputCls}
                placeholder="Town, state or country"
                value={d.placeQuery}
                maxLength={120}
                onChange={(e) => update({ placeQuery: e.target.value, place: null })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPlace(); } }}
              />
              <button type="button" className={btnGhost} onClick={searchPlace} disabled={placeBusy}>
                {placeBusy ? "…" : "Search"}
              </button>
            </div>
            {d.place ? (
              <p className="mt-2 text-sm text-emerald-300">
                ✓ {d.place.label} — {d.place.lat.toFixed(4)}, {d.place.lon.toFixed(4)} — time zone {d.place.zone}
              </p>
            ) : (
              places && places.length > 0 && (
                <ul className="mt-2 divide-y divide-white/10 rounded-xl border border-white/10">
                  {places.map((p) => (
                    <li key={`${p.lat},${p.lon}`}>
                      <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-white/5" onClick={() => { update({ place: p, placeQuery: p.label }); setPlaces(null); }}>
                        {p.label} <span className="text-neutral-500">({p.zone})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
            <p className="mt-1 text-xs text-neutral-500">Place search © OpenStreetMap contributors.</p>
          </div>
        </fieldset>

        {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={btnMain} disabled={busy}>{busy ? "Calculating…" : "Calculate chart"}</button>
          {(dirty || report) && (
            <button type="button" className={btnGhost} onClick={() => { setD(EMPTY); setReport(null); setPlaces(null); setChosen({}); setDirty(false); setError(""); }}>
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Nothing you enter is saved on NorthEDM. Unfinished entries stay on this device for up to a day, until you calculate.
        </p>
      </form>

      {report && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
            <button type="button" className={btnMain} onClick={() => printReport(report.displayName)}>Download PDF</button>
            <button type="button" className={btnGhost} onClick={() => document.querySelector("form")?.scrollIntoView({ behavior: "smooth" })}>Edit details</button>
            <span className="text-xs text-neutral-500">In the print window choose “Save as PDF”.</span>
          </div>
          <AstroHebrewReport report={report} onChooseMatch={busy ? undefined : chooseMatch} />
        </div>
      )}
    </div>
  );
}

// ======================================================================
// Words and Names
// ======================================================================

type Translation = { strongs: string; hebrew: string; pronunciation: string; meaning: string; kjv: string; value: number; url: string };
type Analysis = { normalizedHebrew: string; letters: Array<{ letter: string; value: number }>; total: number; sameValue: Array<{ strongs: string; hebrew: string; pronunciation: string; meaning: string; url: string }>; totalMatches: number };

function LetterBreakdown({ hebrew }: { hebrew: string }) {
  const v = liveValue(hebrew);
  if (v.total == null) return null;
  const g = calculateGematria(hebrew);
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm" dir="rtl">
      {g.letters.map((l, i) => (
        <span key={i} className="rounded-lg border border-white/10 px-2 py-1 text-center">
          <He><span className="text-lg">{l.letter}</span></He>
          <span className="block text-xs text-neutral-400">{l.value}</span>
        </span>
      ))}
      <span className="font-semibold text-emerald-300" dir="ltr">= {g.total}</span>
    </div>
  );
}

function WordsAndNames() {
  const [kind, setKind] = useState<"translate" | "sound" | "analyze">("translate");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [translations, setTranslations] = useState<Translation[] | null>(null);
  const [picked, setPicked] = useState<Translation | null>(null);
  const [soundHebrew, setSoundHebrew] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const sound = useMemo(() => (kind === "sound" ? suggestHebrewSpellings(text) : []), [kind, text]);

  async function run() {
    setError("");
    setBusy(true);
    try {
      if (kind === "translate") {
        const r = await post<{ results: Translation[] }>({ mode: "translate", english: text });
        setTranslations(r.results);
        setPicked(null);
        if (!r.results.length) setError("No Hebrew dictionary word found for that. Try a single, simpler English word.");
      } else if (kind === "analyze") {
        setAnalysis(await post<Analysis>({ mode: "analyze", hebrew: text }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ v: typeof kind; label: string; hint: string }> = [
    { v: "translate", label: "Translate meaning", hint: "Find the Hebrew word for an English word, then pick the sense you mean." },
    { v: "sound", label: "Write the sound", hint: "Spell a name or phrase in Hebrew letters by how it sounds. This is not a translation." },
    { v: "analyze", label: "Analyze Hebrew", hint: "Type Hebrew letters to see each letter's value and the total." },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        {tabs.map((t) => (
          <button key={t.v} type="button" onClick={() => { setKind(t.v); setError(""); setText(""); setTranslations(null); setPicked(null); setAnalysis(null); }} className={`${btn} ${kind === t.v ? "bg-violet-300 text-black" : "border border-white/15 text-neutral-200"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-neutral-400 print:hidden">{tabs.find((t) => t.v === kind)?.hint}</p>
      <form className="flex gap-2 print:hidden" onSubmit={(e) => { e.preventDefault(); if (kind !== "sound") run(); }}>
        <input
          className={`${inputCls} ${kind === "analyze" ? "font-hebrew text-lg" : ""}`}
          dir={kind === "analyze" ? "rtl" : "ltr"}
          lang={kind === "analyze" ? "he" : "en"}
          placeholder={kind === "translate" ? "e.g. smoke" : kind === "sound" ? "e.g. Alec" : "e.g. חי"}
          value={text}
          maxLength={kind === "analyze" ? 200 : 60}
          onChange={(e) => { setText(e.target.value); if (kind === "sound") setSoundHebrew(""); }}
        />
        {kind !== "sound" && <button className={btnMain} disabled={busy || !text.trim()}>{busy ? "…" : "Go"}</button>}
      </form>
      {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}

      <div id={kind === "sound" || picked || analysis ? "ne-words-result" : undefined}>
        {kind === "translate" && translations && translations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-400 print:hidden">Choose the sense you mean:</p>
            <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
              {translations.map((t) => (
                <li key={t.strongs} className={picked && picked.strongs !== t.strongs ? "print:hidden" : ""}>
                  <button type="button" onClick={() => setPicked(t)} className={`w-full px-3 py-2 text-left ${picked?.strongs === t.strongs ? "bg-violet-300/10" : "hover:bg-white/5"}`}>
                    <He><span className="text-lg">{t.hebrew}</span></He> <span className="text-neutral-400">({t.pronunciation})</span> — {t.meaning}{" "}
                    <span className="font-semibold text-emerald-300">{t.value}</span>
                    <span className="block text-xs text-neutral-500">
                      Strong&apos;s {t.strongs} ·{" "}
                      <a href={t.url} target="_blank" rel="noopener noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>dictionary entry</a>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {picked && <LetterBreakdown hebrew={picked.hebrew} />}
          </div>
        )}

        {kind === "sound" && text.trim() && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {sound.map((s) => (
                <button key={s.hebrew} type="button" onClick={() => setSoundHebrew(s.hebrew)} className={`rounded-full border px-3 py-1 text-sm ${(soundHebrew || sound[0]?.hebrew) === s.hebrew ? "border-violet-300 bg-violet-300/15" : "border-white/15"}`}>
                  <He>{s.hebrew}</He> <span className="text-neutral-400">{liveValue(s.hebrew).total}{s.note ? ` · ${s.note}` : ""}</span>
                </button>
              ))}
            </div>
            <input dir="rtl" lang="he" className={`${inputCls} font-hebrew text-lg print:hidden`} value={soundHebrew || sound[0]?.hebrew || ""} onChange={(e) => setSoundHebrew(e.target.value)} aria-label="Edit the Hebrew spelling" />
            <LetterBreakdown hebrew={soundHebrew || sound[0]?.hebrew || ""} />
            <p className="text-xs text-neutral-500">A spelling by sound. It does not carry the name&apos;s meaning.</p>
          </div>
        )}

        {kind === "analyze" && analysis && (
          <div className="space-y-3">
            <LetterBreakdown hebrew={analysis.normalizedHebrew} />
            <p className="text-sm text-neutral-300">
              {analysis.totalMatches > 0
                ? `${analysis.totalMatches} dictionary word${analysis.totalMatches === 1 ? "" : "s"} share the value ${analysis.total}. A shared value is a coincidence of letters, not a shared meaning.`
                : `No dictionary word found with the value ${analysis.total}.`}
            </p>
            <ul className="space-y-1 text-sm">
              {analysis.sameValue.map((w) => (
                <li key={w.strongs}>
                  <He>{w.hebrew}</He> ({w.pronunciation}) — <Mixed text={w.meaning} />{" "}
                  <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-300 underline">{w.strongs}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {(picked || analysis || (kind === "sound" && text.trim())) && (
        <button type="button" className={`${btnGhost} print:hidden`} onClick={() => printReport(`Hebrew_${kind}`)}>Download PDF</button>
      )}
    </div>
  );
}

// ======================================================================
// Number lookup
// ======================================================================

type NumberResult = {
  value: number;
  numeral: string;
  words: string;
  curated: { hebrew?: string; pronunciation?: string; meaning: string; tradition: string } | null;
  matches: Array<{ strongs: string; hebrew: string; pronunciation: string; meaning: string; url: string }>;
  totalMatches: number;
};

function NumberLookup() {
  const [n, setN] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [r, setR] = useState<NumberResult | null>(null);

  async function run() {
    setError("");
    const v = Number(n);
    if (!/^\d{1,4}$/.test(n.trim()) || v > 9999) { setError("Enter a whole number from 0 to 9,999."); return; }
    setBusy(true);
    try {
      setR(await post<NumberResult>({ mode: "number", value: v }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="flex gap-2 print:hidden" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input inputMode="numeric" className={inputCls} placeholder="0 – 9,999" value={n} maxLength={4} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} />
        <button className={btnMain} disabled={busy || !n}>{busy ? "…" : "Look up"}</button>
      </form>
      {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
      {r && (
        <div id="ne-number-result" className="space-y-3 rounded-2xl border border-white/10 p-4">
          <p className="text-3xl font-semibold">{r.value}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
            <dt className="text-neutral-400">In Hebrew words</dt>
            <dd className="text-lg"><He>{r.words}</He> <span className="text-xs text-neutral-500">(standalone counting form)</span></dd>
            <dt className="text-neutral-400">Hebrew numeral</dt>
            <dd className="text-lg">{r.numeral ? <He>{r.numeral}</He> : <span className="text-sm text-neutral-500">none — zero has no letter form</span>}</dd>
            {r.curated && (
              <>
                <dt className="text-neutral-400">Traditional association</dt>
                <dd>{r.curated.hebrew && <><He>{r.curated.hebrew}</He> ({r.curated.pronunciation}) — </>}<Mixed text={r.curated.meaning} /> <span className="text-neutral-500">({r.curated.tradition})</span></dd>
              </>
            )}
          </dl>
          <p className="text-sm text-neutral-300">
            The words in a number (<He>{r.words}</He>) and the letters that add up to it are different things.{" "}
            {r.totalMatches > 0 ? `${r.totalMatches} dictionary words have letters totalling ${r.value}; some are below. Many words can share a number.` : `No dictionary word has letters totalling ${r.value}.`}
          </p>
          <ul className="space-y-1 text-sm">
            {r.matches.map((w) => (
              <li key={w.strongs}>
                <He>{w.hebrew}</He> ({w.pronunciation}) — <Mixed text={w.meaning} />{" "}
                <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-300 underline">{w.strongs}</a>
              </li>
            ))}
          </ul>
          <button type="button" className={`${btnGhost} print:hidden`} onClick={() => printReport(`Number_${r.value}`)}>Download PDF</button>
        </div>
      )}
    </div>
  );
}

// ======================================================================

export function AstroHebrewCalculator() {
  const [mode, setMode] = useState<"chart" | "words" | "number">("chart");
  const modes: Array<{ v: typeof mode; label: string }> = [
    { v: "chart", label: "Birth Chart" },
    { v: "words", label: "Words and Names" },
    { v: "number", label: "Number Lookup" },
  ];
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2 print:hidden" role="tablist">
        {modes.map((m) => (
          <button key={m.v} role="tab" aria-selected={mode === m.v} type="button" onClick={() => setMode(m.v)} className={`${btn} ${mode === m.v ? "bg-violet-300 text-black" : "border border-white/15 text-neutral-200 hover:border-white/40"}`}>
            {m.label}
          </button>
        ))}
      </div>
      <div hidden={mode !== "chart"}><BirthChart /></div>
      <div hidden={mode !== "words"}><WordsAndNames /></div>
      <div hidden={mode !== "number"}><NumberLookup /></div>
    </div>
  );
}
