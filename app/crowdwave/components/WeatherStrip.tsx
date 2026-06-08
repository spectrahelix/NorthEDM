"use client";
import { useEffect, useState } from "react";

type Day = { label: string; icon: string; high: number };

export function WeatherStrip({ lat, lng }: { lat: number; lng: number }) {
  const [days, setDays] = useState<Day[]>([]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!key || key === "your_openweather_key_here") return;

    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${key}&units=imperial`
    )
      .then((r) => r.json())
      .then((data) => {
        const seen = new Set<string>();
        const result: Day[] = [];
        for (const item of data.list ?? []) {
          if (result.length >= 4) break;
          const d = new Date(item.dt * 1000);
          const dayKey = d.toDateString();
          if (!seen.has(dayKey)) {
            seen.add(dayKey);
            result.push({
              label: d.toLocaleDateString("en-US", { weekday: "short" }),
              icon: item.weather?.[0]?.icon ?? "01d",
              high: Math.round(item.main?.temp_max ?? item.main?.temp ?? 0),
            });
          }
        }
        setDays(result);
      })
      .catch(() => {});
  }, [lat, lng]);

  if (!days.length) return null;

  return (
    <div className="mt-4 flex gap-5 border-t border-white/10 pt-4">
      {days.map((day) => (
        <div key={day.label} className="flex flex-col items-center gap-0.5">
          <span className="text-xs text-neutral-500">{day.label}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://openweathermap.org/img/wn/${day.icon}.png`}
            alt=""
            width={32}
            height={32}
          />
          <span className="font-dm-mono text-xs text-neutral-300">{day.high}°F</span>
        </div>
      ))}
    </div>
  );
}
