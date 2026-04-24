/**
 * Weather integration via Open-Meteo.
 *
 * Design choices:
 *   • NO GPS / Capacitor Geolocation. Users type city names in Profile.
 *     → Zero runtime permission prompts, no MIUI background-kill issues,
 *       no battery drain, works offline (using cached data).
 *   • NO API key. Open-Meteo is free for non-commercial use, has CORS
 *     enabled, and doesn't require registration — perfect for a
 *     personal-use Capacitor app.
 *   • Geocoding cached forever in LocalForage (city name → lat/lon).
 *   • Current-weather fetch cached 1h fresh / 6h stale-while-revalidate.
 *   • Fail silently — if the network is down, unreachable, or rate-limited,
 *     the UI simply falls back to time-only theming. No error toasts.
 *
 * All functions are side-effect-free outside of the localforage cache.
 */

import localforage from "localforage";
import type { WeatherCondition } from "./timeTheme";

export interface GeocodeResult {
  name: string;       // Canonical city name returned by Open-Meteo
  country: string;    // ISO-2 country code
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  temperature: number;      // °C
  condition: WeatherCondition;
  wmoCode: number;          // raw WMO code — exposed for future mapping
  isDay: boolean;
  fetchedAt: number;        // ms epoch
  location: string;         // echo of the city name we resolved
}

interface GeocodeCacheShape {
  [cityQuery: string]: GeocodeResult;
}

interface WeatherCacheShape {
  [cacheKey: string]: CurrentWeather;
}

const GEOCODE_CACHE_KEY = "weather_geocode_cache_v1";
const WEATHER_CACHE_KEY = "weather_current_cache_v1";
const FRESH_MS = 60 * 60 * 1000;         // 1 hour
const STALE_MS = 6 * 60 * 60 * 1000;     // 6 hours

/**
 * Map WMO weather codes (as returned by Open-Meteo) to our simplified
 * WeatherCondition enum. Source: https://open-meteo.com/en/docs
 */
function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 2) return "cloudy";
  if (code === 3) return "overcast";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";   // drizzle, rain, freezing rain
  if (code >= 71 && code <= 77) return "snow";   // snowfall, snow grains
  if (code >= 80 && code <= 82) return "rain";   // rain showers
  if (code >= 85 && code <= 86) return "snow";   // snow showers
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "cloudy";
}

/**
 * Resolve a free-text city name ("Kuala Lumpur", "KL", "singapore") into
 * a { latitude, longitude } pair. Cached forever in IndexedDB — city
 * coordinates never change.
 */
export async function geocodeCity(query: string): Promise<GeocodeResult | null> {
  const norm = query.trim().toLowerCase();
  if (!norm) return null;

  // Cache check
  try {
    const cache = (await localforage.getItem<GeocodeCacheShape>(GEOCODE_CACHE_KEY)) || {};
    if (cache[norm]) return cache[norm];
  } catch {
    /* cache read failure is recoverable */
  }

  // Fetch from Open-Meteo Geocoding API
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=1&language=en&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit || typeof hit.latitude !== "number") return null;

    const result: GeocodeResult = {
      name: hit.name,
      country: hit.country_code || "",
      latitude: hit.latitude,
      longitude: hit.longitude,
    };

    // Persist
    try {
      const cache = (await localforage.getItem<GeocodeCacheShape>(GEOCODE_CACHE_KEY)) || {};
      cache[norm] = result;
      await localforage.setItem(GEOCODE_CACHE_KEY, cache);
    } catch {
      /* persistence is best-effort */
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Fetch current weather for a geocoded location, with 1h/6h SWR caching.
 * Returns the cached value even if stale when a fresh fetch fails, so the
 * dashboard always has SOMETHING to show after the first successful load.
 */
export async function getCurrentWeather(
  geo: GeocodeResult
): Promise<CurrentWeather | null> {
  const key = `${geo.latitude.toFixed(3)},${geo.longitude.toFixed(3)}`;
  const now = Date.now();

  // Cache check
  let cached: CurrentWeather | null = null;
  try {
    const cache = (await localforage.getItem<WeatherCacheShape>(WEATHER_CACHE_KEY)) || {};
    cached = cache[key] || null;
  } catch {
    /* ignore */
  }

  // Fresh hit — return as-is.
  if (cached && now - cached.fetchedAt < FRESH_MS) {
    return cached;
  }

  // Otherwise try to fetch. If we have a stale cache we'll fall back to it
  // on failure.
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}` +
      `&longitude=${geo.longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cur = data?.current;
    if (!cur || typeof cur.temperature_2m !== "number") throw new Error("malformed");

    const fresh: CurrentWeather = {
      temperature: Math.round(cur.temperature_2m),
      condition: wmoToCondition(cur.weather_code),
      wmoCode: cur.weather_code,
      isDay: cur.is_day === 1,
      fetchedAt: now,
      location: geo.name,
    };

    // Persist
    try {
      const cache = (await localforage.getItem<WeatherCacheShape>(WEATHER_CACHE_KEY)) || {};
      cache[key] = fresh;
      await localforage.setItem(WEATHER_CACHE_KEY, cache);
    } catch {
      /* best-effort */
    }
    return fresh;
  } catch {
    // Network failed — serve stale cache within SWR window.
    if (cached && now - cached.fetchedAt < STALE_MS) return cached;
    return null;
  }
}

/**
 * Convenience: resolve a city name → coords → current weather in one go.
 * Returns null when the city can't be geocoded OR the network is down
 * AND we have no cache.
 */
export async function weatherForCity(
  city: string
): Promise<CurrentWeather | null> {
  const geo = await geocodeCity(city);
  if (!geo) return null;
  return getCurrentWeather(geo);
}
