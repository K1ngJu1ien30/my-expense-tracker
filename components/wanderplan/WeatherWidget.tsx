"use client";

import { useState, useEffect } from "react";
import { weatherCodeToDescription } from "@/lib/wanderplanConstants";

export default function WeatherWidget({ lat, lng }: { lat: number; lng: number }) {
  const [weather, setWeather] = useState<{ temp: number; desc: string; icon: string; humidity: number; wind: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`,
      { signal: controller.signal }
    )
      .then(r => r.json())
      .then(data => {
        if (data.current) {
          const { description, icon } = weatherCodeToDescription(data.current.weather_code);
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            desc: description,
            icon,
            humidity: data.current.relative_humidity_2m,
            wind: Math.round(data.current.wind_speed_10m),
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [lat, lng]);

  if (!weather) return null;

  return (
    <div className="flex items-center gap-3 bg-muted/40 rounded-2xl p-3">
      <span className="text-3xl">{weather.icon}</span>
      <div className="flex-1">
        <p className="font-bold text-foreground text-sm">{weather.temp}° · {weather.desc}</p>
        <p className="text-[10px] text-muted-foreground font-medium">Humidity {weather.humidity}% · Wind {weather.wind} km/h</p>
      </div>
    </div>
  );
}
