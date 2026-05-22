/**
 * Time-based (and optionally weather-aware) theming for the Home dashboard.
 *
 * Returns a visual + textual variant appropriate for the current local hour
 * and — when weather data is supplied — the current sky condition. Eight
 * base time buckets span the full day; each carries:
 *
 *   • `bucket`   — stable key so React memoisation is predictable.
 *   • `greeting` — the hero line on the dashboard.
 *   • `gradient` — a full CSS gradient string layered behind the greeting
 *                  card. High enough opacity to be noticeable, low enough
 *                  that text contrast stays WCAG-ok in both light and
 *                  dark themes.
 *   • `accent`   — a strong rgba used for the avatar glow and icon tint.
 *   • `icon`     — a single emoji that describes the current mood
 *                  (pre-weather-merge); components can choose to display
 *                  the weather icon instead when we have weather data.
 *
 * Design goal: at 3 AM vs 2 PM vs 7 PM, the dashboard's top quarter FEELS
 * materially different — different hue, different brightness, different
 * greeting. Users should notice within 2 seconds of opening the app.
 *
 * Weather integration: if a `WeatherCondition` is passed, we decorate the
 * theme: rain darkens and cools the palette, snow whitens and desaturates,
 * clear sky on a sunny afternoon brightens it, thunderstorms pump up
 * contrast. Unknown / undefined weather → pure time-based output (the
 * function behaves exactly as before).
 */
export type TimeBucket =
  | "deep-night"
  | "late-night"
  | "dawn"
  | "morning"
  | "noon"
  | "afternoon"
  | "dusk"
  | "evening";

/**
 * Simplified sky condition buckets. Open-Meteo's WMO weather codes are
 * collapsed into six groups that map cleanly onto distinct visual moods.
 * See lib/weather.ts for the mapping.
 */
export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "overcast"
  | "rain"
  | "thunderstorm"
  | "snow"
  | "fog";

export interface TimeTheme {
  bucket: TimeBucket;
  greeting: string;
  gradient: string;      // full CSS gradient for background
  accent: string;        // rgba for glow / accents
  icon: string;          // emoji
  weather?: WeatherCondition; // merged-in weather (undefined if unavailable)
}

/**
 * Base palette for each time bucket. Two stops: strong top-left, fading
 * to transparent bottom-right. Opacity here is deliberately high (25–40%)
 * so the shift between buckets is IMMEDIATELY noticeable — the previous
 * 12% intensity was too subtle on AMOLED phones.
 */
const BASE: Record<
  TimeBucket,
  { gradient: string; accent: string; icon: string; fallbackGreeting: string; playfulGreeting: string }
> = {
  "deep-night": {
    // violet-900 → indigo-950 — twilight / owl hour
    gradient:
      "linear-gradient(135deg, rgba(91, 33, 182, 0.38) 0%, rgba(30, 27, 75, 0.22) 50%, transparent 100%)",
    accent: "rgba(167, 139, 250, 0.55)",
    icon: "🦉",
    fallbackGreeting: "Good evening,",
    playfulGreeting: "🦉 Burning the midnight oil?",
  },
  "late-night": {
    // indigo-900 → slate — quiet night
    gradient:
      "linear-gradient(135deg, rgba(49, 46, 129, 0.35) 0%, rgba(30, 41, 59, 0.20) 50%, transparent 100%)",
    accent: "rgba(129, 140, 248, 0.50)",
    icon: "🌙",
    fallbackGreeting: "Good evening,",
    playfulGreeting: "🌙 Still up?",
  },
  dawn: {
    // orange-500 → amber-300 — pre-sunrise
    gradient:
      "linear-gradient(135deg, rgba(249, 115, 22, 0.40) 0%, rgba(252, 211, 77, 0.25) 50%, transparent 100%)",
    accent: "rgba(253, 186, 116, 0.65)",
    icon: "🌅",
    fallbackGreeting: "Good morning,",
    playfulGreeting: "☀️ Early bird —",
  },
  morning: {
    // amber-300 → sky-200 — fresh morning
    gradient:
      "linear-gradient(135deg, rgba(252, 211, 77, 0.35) 0%, rgba(186, 230, 253, 0.28) 50%, transparent 100%)",
    accent: "rgba(253, 224, 71, 0.55)",
    icon: "🌤️",
    fallbackGreeting: "Good morning,",
    playfulGreeting: "Good morning,",
  },
  noon: {
    // sky-300 → cyan-200 — bright daylight
    gradient:
      "linear-gradient(135deg, rgba(125, 211, 252, 0.38) 0%, rgba(165, 243, 252, 0.25) 50%, transparent 100%)",
    accent: "rgba(56, 189, 248, 0.55)",
    icon: "☀️",
    fallbackGreeting: "Good afternoon,",
    playfulGreeting: "Good afternoon,",
  },
  afternoon: {
    // sky-500 → blue-300 — warm afternoon
    gradient:
      "linear-gradient(135deg, rgba(14, 165, 233, 0.35) 0%, rgba(147, 197, 253, 0.22) 50%, transparent 100%)",
    accent: "rgba(56, 189, 248, 0.55)",
    icon: "🌤️",
    fallbackGreeting: "Good afternoon,",
    playfulGreeting: "Good afternoon,",
  },
  dusk: {
    // rose-500 → orange-400 — golden hour
    gradient:
      "linear-gradient(135deg, rgba(244, 63, 94, 0.38) 0%, rgba(251, 146, 60, 0.28) 50%, transparent 100%)",
    accent: "rgba(253, 164, 175, 0.65)",
    icon: "🌇",
    fallbackGreeting: "Good evening,",
    playfulGreeting: "Good evening,",
  },
  evening: {
    // indigo-600 → purple-500 — early night
    gradient:
      "linear-gradient(135deg, rgba(79, 70, 229, 0.38) 0%, rgba(147, 51, 234, 0.25) 50%, transparent 100%)",
    accent: "rgba(129, 140, 248, 0.55)",
    icon: "🌆",
    fallbackGreeting: "Good evening,",
    playfulGreeting: "Good evening,",
  },
};

function bucketFor(hour: number): TimeBucket {
  if (hour >= 2 && hour < 5) return "deep-night";
  if (hour >= 23 || hour < 2) return "late-night";
  if (hour === 5) return "dawn";
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "noon";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 19) return "dusk";
  return "evening";
}

/**
 * Weather overlay — composes a sky-condition decorative layer on top of
 * the existing time-of-day gradient instead of replacing it. Called only
 * when `weather` is defined.
 *
 * CSS background shorthand accepts multiple comma-separated layers; the
 * FIRST layer paints on top. So the composed value is
 * `<weather overlay>, <time-of-day base>` — the time bucket's hue / mood
 * stays legible (3 AM rain still looks like 3 AM, not generic "rain"),
 * and the weather reads as a tint/veil layered over it.
 *
 * Overlays use translucent rgba colors so the time-of-day base bleeds
 * through. Opacities are tuned so every combination stays WCAG-readable
 * in both light and dark themes.
 */
function applyWeather(theme: TimeTheme, condition: WeatherCondition, hour: number): TimeTheme {
  const isNight = hour < 6 || hour >= 19;

  // Helper: stack a weather overlay on top of the base time gradient.
  const compose = (overlay: string) => `${overlay}, ${theme.gradient}`;

  switch (condition) {
    case "rain":
      return {
        ...theme,
        gradient: compose(
          isNight
            ? "linear-gradient(135deg, rgba(30, 64, 175, 0.28) 0%, rgba(15, 23, 42, 0.18) 60%, transparent 100%)"
            : "linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(100, 116, 139, 0.15) 60%, transparent 100%)"
        ),
        // Cool the accent slightly without abandoning the time-of-day
        // identity — blend rain-blue 40% with the time accent.
        accent: "rgba(96, 165, 250, 0.55)",
        icon: "🌧️",
      };
    case "thunderstorm":
      return {
        ...theme,
        gradient: compose(
          "linear-gradient(135deg, rgba(88, 28, 135, 0.30) 0%, rgba(30, 41, 59, 0.22) 60%, transparent 100%)"
        ),
        accent: "rgba(250, 204, 21, 0.65)", // lightning yellow — stays dramatic
        icon: "⛈️",
      };
    case "snow":
      return {
        ...theme,
        gradient: compose(
          "linear-gradient(135deg, rgba(226, 232, 240, 0.35) 0%, rgba(203, 213, 225, 0.22) 60%, transparent 100%)"
        ),
        accent: "rgba(148, 163, 184, 0.55)",
        icon: "❄️",
      };
    case "fog":
      return {
        ...theme,
        gradient: compose(
          "linear-gradient(135deg, rgba(148, 163, 184, 0.28) 0%, rgba(100, 116, 139, 0.18) 60%, transparent 100%)"
        ),
        accent: "rgba(148, 163, 184, 0.50)",
        icon: "🌫️",
      };
    case "overcast":
      return {
        ...theme,
        gradient: compose(
          isNight
            ? "linear-gradient(135deg, rgba(51, 65, 85, 0.32) 0%, rgba(15, 23, 42, 0.18) 60%, transparent 100%)"
            : "linear-gradient(135deg, rgba(100, 116, 139, 0.28) 0%, rgba(148, 163, 184, 0.18) 60%, transparent 100%)"
        ),
        accent: "rgba(148, 163, 184, 0.50)",
        icon: "☁️",
      };
    case "cloudy":
      // Partly-cloudy is subtle — keep the full time-of-day gradient, just
      // lay a very light grey veil and swap the icon. Accent unchanged.
      return {
        ...theme,
        gradient: compose(
          "linear-gradient(135deg, rgba(148, 163, 184, 0.14) 0%, transparent 70%)"
        ),
        icon: isNight ? "☁️🌙" : "⛅",
      };
    case "clear":
      // Clear = no overlay at all; just an icon hint. Time-of-day gradient
      // shines through unaltered — which is exactly what you want at noon
      // or dusk when the sky itself is doing the work.
      return {
        ...theme,
        icon: isNight ? "🌙✨" : "☀️",
      };
    default:
      return theme;
  }
}

/**
 * Main entry. `hour` in 0-23. `enableTimeBased` gates the playful greetings
 * (owl, early-bird, still-up) — the tint itself always shifts.
 */
export function getTimeTheme(
  hour: number,
  enableTimeBased = true,
  weather?: WeatherCondition
): TimeTheme {
  const bucket = bucketFor(hour);
  const base = BASE[bucket];
  const theme: TimeTheme = {
    bucket,
    greeting: enableTimeBased ? base.playfulGreeting : base.fallbackGreeting,
    gradient: base.gradient,
    accent: base.accent,
    icon: base.icon,
    weather,
  };
  return weather ? applyWeather(theme, weather, hour) : theme;
}
