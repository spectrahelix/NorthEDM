import { PA_STATE_FORESTS, type StateForest } from "@/utils/paStateForests";

// Live conditions for every Pennsylvania state forest, from Open-Meteo (no
// key). One request covers all forests (Open-Meteo takes comma-separated
// coordinate lists and returns one result per point), cached for an hour.
//
// Only measured/forecast numbers are shown — temperature, rain over the past
// 7 days and the next 3 days. No "good / fair / poor" verdicts: the old
// hand-written foraging notes were never updated and nobody could check them.

type Daily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
};
type Point = {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: Daily;
};

type ForestNow = StateForest & {
  now: number | null;
  nowIcon: string;
  rain7: number | null; // inches, past 7 days
  next: { label: string; icon: string; high: number; low: number; rain: number }[];
};

function wmoIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

const PAST_DAYS = 7;

async function loadConditions(): Promise<ForestNow[] | null> {
  const params = new URLSearchParams({
    latitude: PA_STATE_FORESTS.map((f) => f.lat).join(","),
    longitude: PA_STATE_FORESTS.map((f) => f.lng).join(","),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: "America/New_York",
    past_days: String(PAST_DAYS),
    forecast_days: "4",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Point | Point[];
    const points = Array.isArray(json) ? json : [json];
    if (points.length !== PA_STATE_FORESTS.length) return null;

    return PA_STATE_FORESTS.map((forest, i) => {
      const p = points[i];
      const d = p.daily;
      let rain7: number | null = null;
      const next: ForestNow["next"] = [];
      if (d?.time?.length) {
        // The first PAST_DAYS entries are history; index PAST_DAYS is today.
        rain7 = d.precipitation_sum
          .slice(0, PAST_DAYS)
          .reduce((s, v) => s + (Number(v) || 0), 0);
        for (let j = PAST_DAYS; j < d.time.length && next.length < 3; j++) {
          next.push({
            label:
              j === PAST_DAYS
                ? "Today"
                : new Date(`${d.time[j]}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
            icon: wmoIcon(Number(d.weather_code[j] ?? 0)),
            high: Math.round(Number(d.temperature_2m_max[j] ?? 0)),
            low: Math.round(Number(d.temperature_2m_min[j] ?? 0)),
            rain: Number(d.precipitation_sum[j] ?? 0),
          });
        }
      }
      return {
        ...forest,
        now: p.current?.temperature_2m != null ? Math.round(p.current.temperature_2m) : null,
        nowIcon: wmoIcon(Number(p.current?.weather_code ?? 0)),
        rain7,
        next,
      };
    });
  } catch {
    return null;
  }
}

export async function ForestWeather() {
  const forests = await loadConditions();

  return (
    <div>
      {!forests ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-neutral-500">
          Weather service didn&apos;t answer just now — conditions will be back on the next refresh.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {forests.map((f) => (
            <a
              key={f.name}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight">{f.name}</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{f.area}</p>
                </div>
                {f.now != null && (
                  <span className="shrink-0 font-dm-mono text-lg leading-none text-neutral-100">
                    <span aria-hidden="true">{f.nowIcon}</span> {f.now}°
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-4">
                {f.next.map((d) => (
                  <div key={d.label} className="flex flex-col items-center gap-0.5">
                    <span className="text-[11px] text-neutral-500">{d.label}</span>
                    <span className="text-base leading-none" aria-hidden="true">{d.icon}</span>
                    <span className="font-dm-mono text-[11px] text-neutral-300">
                      {d.high}° <span className="text-neutral-600">{d.low}°</span>
                    </span>
                    {d.rain >= 0.01 && (
                      <span className="font-dm-mono text-[10px] text-[#3AFFD4]">{d.rain.toFixed(2)}″</span>
                    )}
                  </div>
                ))}
              </div>
              {f.rain7 != null && (
                <p className="mt-3 border-t border-white/10 pt-2 font-dm-mono text-[11px] text-neutral-500">
                  Rain, past 7 days:{" "}
                  <span className="text-neutral-300">{f.rain7.toFixed(2)}″</span>
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
