/**
 * Lightweight debug logger gated behind development / explicit debug flag.
 *
 * Production mobile WebViews pay a measurable serialization + bridge cost for
 * every `console.log` call. Keep real errors on `console.error`, and route
 * verbose lifecycle / sync / pagination / cache diagnostics through `debugLog`.
 *
 * Enable at runtime in production if needed:
 *   localStorage.setItem("__tracker_debug", "1")
 *   // or: window.__TRACKER_DEBUG__ = true
 */

declare global {
  interface Window {
    __TRACKER_DEBUG__?: boolean;
  }
}

export function isDebugLoggingEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (typeof window !== "undefined") {
    if (window.__TRACKER_DEBUG__ === true) return true;
    try {
      return localStorage.getItem("__tracker_debug") === "1";
    } catch {
      return false;
    }
  }
  return false;
}

export function debugLog(...args: unknown[]): void {
  if (isDebugLoggingEnabled()) {
    console.log(...args);
  }
}

export function debugWarn(...args: unknown[]): void {
  if (isDebugLoggingEnabled()) {
    console.warn(...args);
  }
}
