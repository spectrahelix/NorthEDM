"use client";
import { useEffect, useState } from "react";

// Forecast strip for an event card.
//
// Two things were wrong with the previous version.
//
// 1. IT NEVER RENDERED. It required NEXT_PUBLIC_OPENWEATHER_API_KEY, which was
//    never set in any environment, so every card silently returned null. The
//    feature was built, shipped, and dead. Open-Meteo needs no key at all, so
//    there is nothing left to forget to configure.
//
// 2. IT SHOWED THE WRONG DAYS. It always fetched "the next four days from now",
//    regardless of when the event actually was — so a festival three months out
//    displayed this week's weather as if it were the forecast for the event.
//    Now it shows the days the event actually runs, and renders nothing at all
//    when the event is beyond the forecast horizon, because a made-up forecast
//    is worse than no forecast.

type Day = { label: string; icon: string; high: number; low: number };

// WMO weather codes, which is what Open-Meteo returns.
// https://open-meteo.com/en/docs — grouped to the granularity a festival-goer
// actually cares about: can I expect sun, rain, snow or a storm.
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

const FORECAST_HORIZON_DAYS = 16; // as far ahead as Open-Meteo will forecast

export function WeatherStrip({
  lat,
  lng,
  startDate,
  endDate,
}: {
  lat: number;
  lng: number;
  /** Event start, YYYY-MM-DD. Omitted = show the next few days. */
  startDate?: string | null;
  endDate?: string | null;
}) {
  const [days, setDays] = useState<Day[]>([]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(`${startDate}T00:00:00`) : today;
    const end = endDate ? new Date(`${endDate}T00:00:00`) : start;

    // How far out is the event? Beyond the horizon there is nothing honest to
    // show, so show nothing.
    const daysUntilEnd = Math.floor((end.getTime() - today.getTime()) / 86_400_000);
    const daysUntilStart = Math.floor((start.getTime() - today.getTime()) / 86_400_000);
    if (daysUntilEnd < 0 || daysUntilStart > FORECAST_HORIZON_DAYS) return;

    // Ask for enough days to reach the end of the event (capped), then keep
    // only the ones the event actually covers.
    const needed = Math.min(Math.max(daysUntilEnd + 1, 1), FORECAST_HORIZON_DAYS);

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      temperature_unit: "fahrenheit",
      timezone: "America/New_York",
      forecast_days: String(needed),
    });

    let cancelled = false;
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.daily?.time) return;
        const { time, weather_code, temperature_2m_max, temperature_2m_min } = data.daily;
        const out: Day[] = [];
        for (let i = 0; i < time.length && out.length < 5; i++) {
          const d = time[i] as string;
          // Only the days this event actually runs.
          if (startDate && (d < startDate || d > (endDate || startDate))) continue;
          out.push({
            label: new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
            icon: wmoIcon(Number(weather_code?.[i] ?? 0)),
            high: Math.round(Number(temperature_2m_max?.[i] ?? 0)),
            low: Math.round(Number(temperature_2m_min?.[i] ?? 0)),
          });
        }
        setDays(out);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [lat, lng, startDate, endDate]);

  if (!days.length) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-5 border-t border-white/10 pt-4">
      {days.map((day, i) => (
        <div key={`${day.label}-${i}`} className="flex flex-col items-center gap-0.5">
          <span className="text-xs text-neutral-500">{day.label}</span>
          <span className="text-xl leading-none" aria-hidden="true">
            {day.icon}
          </span>
          <span className="font-dm-mono text-xs text-neutral-300">
            {day.high}° <span className="text-neutral-600">{day.low}°</span>
          </span>
        </div>
      ))}
    </div>
  );
}
