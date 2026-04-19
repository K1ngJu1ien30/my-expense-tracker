# Changelog

All notable changes to **Expense Tracker Pro** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — The Official Release & Native Polish — 2026-04-19

The first stable, production-grade release. This version represents a complete architectural overhaul from the prototype, with emphasis on native feel, offline resilience, and multi-currency correctness.

### Major
- **Refactored Hub UI** into a multi-currency Wise-style horizontal wallet carousel. Each account card displays its own currency prefix and isolated balance — no silent FX conversions, no mixed-currency aggregates.
- **Migrated storage engine** from `localStorage` to `localforage` (IndexedDB) for infinite offline scaling. All monetary values now stored as integer cents to eliminate floating-point drift.
- **Implemented Soft Deletes** via a `deleted_at` timestamp column. Rows are never physically removed, preventing the classic cross-device sync conflict where a delete on Phone A gets re-seeded from Phone B's cache. Provider-level queries filter `!t.deleted_at`.
- **Idempotent Sync** — every transaction now carries a client-generated `crypto.randomUUID()` and uses Supabase `upsert({ onConflict: 'id' })`, making retries safe.

### Feature
- **Accountant Export Wizard** — date-range, account, and category filtering, UTF-8 BOM CSV generation via Capacitor Filesystem, handoff to native Android share sheet.
- **Programmatic Smart Insights** — automatic week-over-week spending delta callouts on the Stats page.
- **Upcoming widget** on the Hub — surfaces auto-deducting subscriptions and utilities in the days before their billing date.
- **Empty states** across every list view with meaningful calls-to-action.
- **Account archiving** — hide travel or dormant accounts from daily view without losing history; restore with one tap.

### UI/UX
- **Eradicated every native HTML `<select>` and `<input type="date">`** in the codebase. Replaced with custom chevron-triggered dropdowns and a reusable `CustomDatePicker` component featuring an iOS-style inline calendar grid, M–S weekday headers, month navigation, and accent-colored selection.
- **Pill pickers** for short enumerations (currency, theme, account type).
- **Compact wallet carousel** — tightened card dimensions and restructured account ordering to preserve user sort preference with case-insensitive consolidation.
- **Pending-balance tooltip** with contextual help icon.
- **Typed Recharts tooltips** for full TypeScript safety across the trend visualization.

### Organization
- **Relocated Subscriptions and Utilities** out of the Stats page and into a dedicated **Financial Planning** module (renamed from "Goals"), alongside Savings Goals. Stats now shows a compact read-only summary card.

### Easter Egg
- **"Derry" cinematic sequence** — an 8-second multi-phase jump-scare overlay (blackout → blood vignette → jump scare → fade) triggered by amount `6.66` or the keyword `pennywise`. Uses `Haptics.vibrate({ duration: 800 })` for tactile reinforcement.

### Fixed
- Stale-closure bug where `refreshData` captured outdated categories and overwrote the cache on cold boot — resolved via a synced `useRef`.
- Case-mismatch ghost-account duplication on the Hub carousel.
- Floating-point rounding errors in aggregate totals (now integer cents throughout).

---

## [0.9.0] — The Hardware Integration Update — 2026-03-10

### Feature
- Integrated **`@capacitor/biometric-auth`** — fingerprint and FaceID gate on cold launch. Failed authentication returns the user to the password screen with no exposed numeric fallback.
- **Flagship X-Axis Linear Haptics** — `Haptics.vibrate({ duration: 10 })` micro-vibrations on every tap, swipe, and confirm. Tuned specifically for Xiaomi, Samsung, and Pixel linear-resonant actuators.

### Fixed
- **Intercepted Android hardware back-swipe** so it routes through `router.back()` instead of killing the Capacitor WebView. Respects `canGoBack` state to prevent dead-ends.

---

## [0.8.0] — The Radar Engine — 2026-01-22

### Feature
- Integrated **`CapacitorHttp`** to bypass browser CORS restrictions and Cloudflare WAF blocks when fetching third-party feeds from inside the WebView.
- **Robust XML parsing** for Tech and Audiophile RSS feed ingestion — tolerant of malformed CDATA, missing namespaces, and inconsistent pub-date formats.

---

## [0.1.0] — Initial Prototype — 2025-11-05

### Base
- Core CRUD operations for transactions, accounts, and categories.
- Next.js App Router scaffolding with basic page hierarchy.
- Initial Supabase integration (auth + transactions table, no RLS yet).
- String-based `localStorage` persistence (pre-LocalForage, pre-integer-cents).
