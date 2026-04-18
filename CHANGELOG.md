# Changelog

All notable changes to **Tracker** are documented here. This project uses [Semantic Versioning](https://semver.org/).

---

## v5.0.0 — The Wallet & Hardware Update
**April 19, 2026**

### Major
- **Multi-Currency Wallet Carousel**: Refactored the Hub dashboard into a compact horizontal account carousel (Wise-style). Each account displays its own balance with automatic currency prefix detection (SGD, USD, JPY). Cards respect the user's custom drag-to-reorder sort order.
- **Accountant Export Wizard**: Full CSV report generation via `@capacitor/filesystem` + `@capacitor/share`. Supports "Current Month" or "All Time" scope with native share sheet integration (WhatsApp, Email, Google Drive).
- **Account Archiving**: Accounts can now be archived for travel/temporary ledgers. Archived accounts are hidden from all dropdowns and the Dashboard carousel but preserve full transaction history. Restorable from Profile → Manage Accounts.
- **Account Object Migration**: Internal accounts state migrated from `string[]` to `Array<{ name, isArchived }>` with automatic backward-compatible migration for existing users (zero data loss).

### Feature
- Case-insensitive account consolidation — "Tng NFC Card" and "Tng Nfc card" now resolve to a single canonical entry.
- Ghost account recovery — legacy/deleted accounts with transaction history automatically appear at the end of the carousel.
- Standardized currency options to `["RM", "SGD", "USD", "JPY"]` across Profile and Transaction Modal.
- Live exchange rate conversion in the Transaction Modal (via `open.er-api.com`, cached for offline).

### Polish
- Upgraded to **Flagship X-Axis Linear Haptics** — `lightTick()` now uses 10ms micro-vibrations optimized for Xiaomi/Samsung linear motors.
- Tightened wallet card padding and typography for a premium, compact look.
- Removed redundant account balance pills from Analytics page (Hub is now the single source).
- Fixed floating-point precision in Spending Trend chart tooltips (enforced `.toFixed(2)`).

### Easter Egg
- **"Derry" Cinematic Jump Scare** — Trigger: amount `6.66` or note containing "pennywise". Multi-stage 8-second horror sequence: pitch-black blood vignette → creeping text ("We all float down here...") → CSS blood drip → 200px 🤡 jump scare with `jumpScare` CSS keyframe → 800ms maximum device vibration → slow fade to normal. Body glitch filter applied for the full duration.
- **Creepy Heartbeat Haptic**: New `NativeHaptics.creepyHeartbeat()` — 5 double-pulse vibration cycles (50ms + 80ms) over 3 seconds simulating an anxious heartbeat.

### Fix
- AMOLED mode now forcefully disables when Dark Mode is toggled off.
- Category persistence: categories now initialize from localStorage cache on mount and persist immediately on every add/delete/reorder.

---

## v4.1.0 — The Native Polish Update
**April 2026**

### Fix
- Intercepted Android hardware back-swipe to use Next.js `router.back()` via Capacitor's native `canGoBack` event parameter. Exits app cleanly on root paths.
- Stripped `next/font/google` (Geist fonts) entirely. App now uses native system fonts (Roboto on Android, San Francisco on iOS) via Tailwind's `font-sans` stack. Eliminates build failures from Google Fonts fetch timeouts.
- Disabled WebKit tap-highlights (`-webkit-tap-highlight-color: transparent`), context menus, and drag events across all elements for a true native feel.
- App-switcher privacy blur overlay via `@capacitor/app` `appStateChange` listener.

---

## v4.0.0 — The Radar Engine
**March 2026**

### Major
- Integrated **Radar Tracker** module — personal content feed aggregating RSS, TMDB cinema, and streaming platform drops.
- RSS fetching via `api.rss2json.com` (native `DOMParser` was crashing on device with namespaced XML tags — reverted from direct parsing).

### Feature
- TMDB cinema listings (Malaysian market) with poster art.
- Per-platform streaming drops: Netflix, Disney+, Amazon Prime, Apple TV+, HBO Go.
- Unified feed with filter pills by source, deduplication, and broken image fallbacks.
- All TMDB functions wrapped in try/catch for graceful API failure handling.

---

## v3.0.0 — The Security Update
**February 2026**

### Major
- Integrated `@aparajita/capacitor-biometric-auth` for native fingerprint/FaceID authentication.
- Forced biometric/PIN gatekeeper on app resume and cold boot.

### Feature
- 6-digit PIN lock with visual dot indicators and numpad UI.
- PIN stored in `@capacitor/preferences` (native secure storage) with localStorage fallback.
- Biometric requires PIN to be enabled first. `allowDeviceCredential: false` prevents background tap bypass.
- PIN error triggers `NativeHaptics.errorShake()` (300ms vibration); success triggers `successMedium()`.

---

## v2.0.0 — The Offline-First Engine
**January 2026**

### Major
- Transitioned from live-only Supabase calls to a **localStorage hydration pattern**.
- App now loads instantly without network connection — full UI rendered from `tracker_data_cache`.

### Feature
- Offline transaction queue: expenses logged without connectivity are saved to `offline_tx_queue`, prepended to cached transactions for accurate balances, and auto-synced when network returns.
- `isHydrating` loading gate blocks UI during hydration — prevents zero-balance flash.
- Explicit Supabase error detection: `select()` doesn't throw on network failure, so errors are manually checked and thrown.
- Strict null checks prevent caching empty data arrays.
- Network status detection via both browser events and `@capacitor/network` native plugin.
- Post-sync `refreshData()` call replaces offline IDs with server-assigned UUIDs.

---

## v1.0.0 — Initial Release
**December 2025**

### Base
- Core CRUD operations for expenses (Income, Expense, Transfer types).
- Next.js App Router with static export compiled to Android APK via Capacitor.
- Supabase backend with email/password authentication and Row Level Security.
- Basic dashboard with total balance, today's spending, and 7-day trend chart.
- Category and account management in Profile.
- Dark mode toggle with accent color selection.
- Savings goals with progress bars and dashboard pinning.
- Subscription and utility tracking with billing day configuration.
- Dual-layer history filters (Time × Category with AND logic).
- Analytics: category pie chart, cash flow bar chart, spending velocity projection.

---

*Private project. All rights reserved.*
