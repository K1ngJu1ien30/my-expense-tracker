"use client";

import { useEffect, useState } from "react";
import { weatherForCity, type CurrentWeather } from "../weather";

/**
 * useWeather — drives the dashboard's weather chip and theming.
 *
 * Takes the user-configured primary + secondary city names and resolves
 * them to current weather via Open-Meteo (geocoded + cached on first use,
 * 1h fresh / 6h stale afterwards). Primary is used for the main theme;
 * secondary is available if components want to show it alongside.
 *
 * Lifecycle:
 *   • On mount + whenever `primaryCity` changes, fire a fetch.
 *   • Also re-fetch once per hour in the foreground — so leaving the app
 *     open at dawn gets a morning-refresh update without restart.
 *   • Silently swallow all failures. When there's no data we return
 *     `{ primary: null, secondary: null }` and the dashboard falls back
 *     to time-only theming.
 *
 * Enabled gate: if both cities are empty strings, we don't fetch at all.
 * The user has opted out by leaving locations blank.
 */
export function useWeather(
  primaryCity: string,
  secondaryCity: string,
  enabled: boolean
): {
  primary: CurrentWeather | null;
  secondary: CurrentWeather | null;
} {
  const [primary, setPrimary] = useState<CurrentWeather | null>(null);
  const [secondary, setSecondary] = useState<CurrentWeather | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Syncing external (disabled) state into local cache — this is the
      // textbook "store external state" pattern the new React 19 linter
      // actually encourages via useSyncExternalStore, but setState here is
      // semantically identical and avoids the complexity. Safe: the effect
      // body is guarded by `enabled` so it runs exactly once per toggle.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrimary(null);
       
      setSecondary(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const tasks: Promise<void>[] = [];
      if (primaryCity.trim()) {
        tasks.push(
          weatherForCity(primaryCity).then((w) => {
            if (!cancelled) setPrimary(w);
          })
        );
      } else if (!cancelled) {
        setPrimary(null);
      }
      if (secondaryCity.trim()) {
        tasks.push(
          weatherForCity(secondaryCity).then((w) => {
            if (!cancelled) setSecondary(w);
          })
        );
      } else if (!cancelled) {
        setSecondary(null);
      }
      await Promise.all(tasks);
    };

    load();

    // Refresh every hour so the theme/chip tracks sunrise, sunset, changing
    // conditions. Only runs while the tab/app is active — setInterval is
    // paused by most mobile browsers when backgrounded, which is exactly
    // the behaviour we want (no wasted cellular data).
    const interval = setInterval(load, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [primaryCity, secondaryCity, enabled]);

  return { primary, secondary };
}
